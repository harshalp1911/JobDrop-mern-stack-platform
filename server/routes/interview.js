const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const { aiLimiter, heavyAiLimiter } = require('../middleware/rateLimit');
const Interview = require('../models/Interview');
const Resume = require('../models/Resume');
const validateObjectId = require('../middleware/validateObjectId');
const { startInterview, getNextQuestion, generateFeedback } = require('../services/ai');

const router = express.Router();
router.param('id', validateObjectId);

const LEVELS = Interview.schema.path('level').options.enum;
const DURATIONS = Interview.schema.path('duration').options.enum;
const TYPES = Interview.schema.path('type').options.enum;

// Small allowance for network latency when deciding whether time ran out
const TIME_UP_GRACE_MS = 5 * 1000;

const msRemaining = (interview) =>
  interview.startedAt
    ? interview.startedAt.getTime() + interview.duration * 60 * 1000 - Date.now()
    : interview.duration * 60 * 1000;

const isTimeUp = (interview) => msRemaining(interview) <= TIME_UP_GRACE_MS;

// Sent to the client so its countdown doesn't depend on the device clock
const remainingSeconds = (interview) =>
  interview.status === 'in_progress' ? Math.max(0, Math.round(msRemaining(interview) / 1000)) : null;

// How long a respond request may hold the lock before it's considered stuck
const RESPOND_LOCK_STALE_MS = 60 * 1000;

const TIME_UP_MESSAGE = "We've run out of time. Thank you for the interview! Let me prepare your feedback.";

// Create a new interview session
router.post('/create', auth, async (req, res) => {
  try {
    const { resumeId, level, duration, type } = req.body;

    if (!resumeId || !level || !duration) {
      return res.status(400).json({ message: 'Resume, level, and duration are required' });
    }
    if (!mongoose.Types.ObjectId.isValid(resumeId)) {
      return res.status(400).json({ message: 'Invalid resume' });
    }
    if (!LEVELS.includes(level)) {
      return res.status(400).json({ message: `Level must be one of: ${LEVELS.join(', ')}` });
    }
    if (!DURATIONS.includes(Number(duration))) {
      return res.status(400).json({ message: `Duration must be one of: ${DURATIONS.join(', ')} minutes` });
    }
    if (type && !TYPES.includes(type)) {
      return res.status(400).json({ message: `Type must be one of: ${TYPES.join(', ')}` });
    }

    const resume = await Resume.findOne({ _id: resumeId, user: req.user._id });
    if (!resume || !resume.isAnalyzed) {
      return res.status(400).json({ message: 'Resume not found or not analyzed yet' });
    }

    const interview = new Interview({
      user: req.user._id,
      resume: resumeId,
      level,
      duration: Number(duration),
      type: type || 'mixed',
      status: 'setup',
    });

    await interview.save();

    res.status(201).json({
      message: 'Interview session created',
      interview: {
        id: interview._id,
        level: interview.level,
        duration: interview.duration,
        type: interview.type,
        status: interview.status,
      },
    });
  } catch (error) {
    console.error('Create interview error:', error);
    res.status(500).json({ message: 'Failed to create interview' });
  }
});

// Start the interview - get the first AI message
router.post('/:id/start', auth, aiLimiter, async (req, res) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, user: req.user._id });
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }
    // Starting twice would reset the clock and add a second greeting
    if (interview.status !== 'setup') {
      return res.status(409).json({ message: 'This interview has already been started' });
    }

    const resume = await Resume.findById(interview.resume);
    if (!resume) {
      return res.status(410).json({ message: 'The resume for this interview no longer exists' });
    }

    const firstMessage = await startInterview(
      resume.analysis,
      interview.level,
      interview.type,
      req.user.name
    );

    interview.status = 'in_progress';
    interview.startedAt = new Date();
    interview.conversation.push({
      role: 'ai',
      content: firstMessage,
    });

    await interview.save();

    res.json({
      message: firstMessage,
      interview: {
        id: interview._id,
        status: interview.status,
        startedAt: interview.startedAt,
        remainingSeconds: remainingSeconds(interview),
        duration: interview.duration,
      },
    });
  } catch (error) {
    console.error('Start interview error:', error);
    res.status(500).json({ message: 'Failed to start interview' });
  }
});

// Send user response and get next AI question
router.post('/:id/respond', auth, aiLimiter, async (req, res) => {
  const { userMessage } = req.body;

  if (typeof userMessage !== 'string' || !userMessage.trim()) {
    return res.status(400).json({ message: 'Response is required' });
  }

  let interview;
  try {
    // Take a per-interview lock atomically so two answers sent at the same
    // moment can't both be processed (duplicate messages, double AI calls).
    // A lock older than RESPOND_LOCK_STALE_MS is treated as abandoned.
    interview = await Interview.findOneAndUpdate(
      {
        _id: req.params.id,
        user: req.user._id,
        status: 'in_progress',
        $or: [
          { respondingSince: null },
          { respondingSince: { $lt: new Date(Date.now() - RESPOND_LOCK_STALE_MS) } },
        ],
      },
      { $set: { respondingSince: new Date() } },
      { new: true }
    );

    if (!interview) {
      const existing = await Interview.findOne({ _id: req.params.id, user: req.user._id })
        .select('status');
      if (existing?.status === 'in_progress') {
        return res.status(409).json({ message: 'Still working on your previous answer' });
      }
      return res.status(400).json({ message: 'Interview not found or not in progress' });
    }

    const resume = await Resume.findById(interview.resume);
    if (!resume) {
      return res.status(410).json({ message: 'The resume for this interview no longer exists' });
    }

    // Add user message to conversation
    interview.conversation.push({
      role: 'user',
      content: userMessage.trim().slice(0, 5000),
    });

    // The server's clock is the source of truth for the time limit
    if (isTimeUp(interview)) {
      interview.conversation.push({ role: 'ai', content: TIME_UP_MESSAGE });
      interview.status = 'completed';
      interview.endedAt = new Date();
      interview.respondingSince = null;
      await interview.save();

      return res.json({
        message: TIME_UP_MESSAGE,
        isComplete: true,
        interviewId: interview._id,
      });
    }

    const timeRemaining = Math.max(0, msRemaining(interview) / 1000 / 60);

    // Get next AI question
    const aiResponse = await getNextQuestion(
      interview.conversation,
      resume.analysis,
      interview.level,
      interview.type,
      Math.round(timeRemaining)
    );

    interview.conversation.push({
      role: 'ai',
      content: aiResponse,
    });
    interview.respondingSince = null;

    await interview.save();

    res.json({
      message: aiResponse,
      isComplete: false,
      timeRemaining: Math.round(timeRemaining),
      remainingSeconds: remainingSeconds(interview),
    });
  } catch (error) {
    console.error('Respond error:', error);
    res.status(500).json({ message: 'Failed to process response' });
  } finally {
    // Always release the lock if this request still holds it (error paths,
    // early returns). Nothing was saved on failure, so the user can retry.
    if (interview?.respondingSince) {
      await Interview.updateOne(
        { _id: interview._id, respondingSince: interview.respondingSince },
        { $set: { respondingSince: null } }
      ).catch((err) => console.error('Failed to release respond lock:', err));
    }
  }
});

// End the interview (user hung up, or the client timer ran out)
router.post('/:id/end', auth, async (req, res) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, user: req.user._id });
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    // Already finished: don't overwrite the original outcome
    if (interview.status === 'setup' || interview.status === 'in_progress') {
      // The server decides whether the full time was used, not the client
      interview.status = interview.status === 'in_progress' && isTimeUp(interview)
        ? 'completed'
        : 'ended_early';
      interview.endedAt = new Date();
      await interview.save();
    }

    res.json({
      message: 'Interview ended',
      interviewId: interview._id,
      status: interview.status,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to end interview' });
  }
});

// Generate feedback for completed interview
router.post('/:id/feedback', auth, heavyAiLimiter, async (req, res) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, user: req.user._id });
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    // Feedback is generated once; later visits get the saved result
    if (interview.feedback?.generatedAt) {
      return res.json({ feedback: interview.feedback });
    }

    if (interview.status === 'setup') {
      return res.status(400).json({ message: 'This interview has not been started' });
    }

    if (!interview.conversation.some((m) => m.role === 'user')) {
      return res.status(400).json({ message: 'Not enough conversation to generate feedback' });
    }

    const resume = await Resume.findById(interview.resume);
    if (!resume) {
      return res.status(410).json({ message: 'The resume for this interview no longer exists' });
    }
    const feedback = await generateFeedback(
      interview.conversation,
      resume.analysis,
      interview.level
    );

    interview.feedback = { ...feedback, generatedAt: new Date() };
    if (interview.status === 'in_progress') {
      interview.status = 'completed';
      interview.endedAt = new Date();
    }
    await interview.save();

    res.json({ feedback: interview.feedback });
  } catch (error) {
    console.error('Feedback error:', error);
    res.status(500).json({ message: 'Failed to generate feedback' });
  }
});

// Get interview details
router.get('/:id', auth, async (req, res) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, user: req.user._id })
      .populate('resume', 'fileName analysis');

    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    res.json({ interview, remainingSeconds: remainingSeconds(interview) });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all interviews for user
router.get('/', auth, async (req, res) => {
  try {
    const interviews = await Interview.find({ user: req.user._id })
      .populate('resume', 'fileName')
      .select('-conversation')
      .sort({ createdAt: -1 });

    res.json({ interviews });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

const express = require('express');
const auth = require('../middleware/auth');
const Interview = require('../models/Interview');
const Resume = require('../models/Resume');
const { startInterview, getNextQuestion, generateFeedback } = require('../services/ai');

const router = express.Router();

// Create a new interview session
router.post('/create', auth, async (req, res) => {
  try {
    const { resumeId, level, duration, type } = req.body;

    if (!resumeId || !level || !duration) {
      return res.status(400).json({ message: 'Resume, level, and duration are required' });
    }

    const resume = await Resume.findOne({ _id: resumeId, user: req.user._id });
    if (!resume || !resume.isAnalyzed) {
      return res.status(400).json({ message: 'Resume not found or not analyzed yet' });
    }

    const interview = new Interview({
      user: req.user._id,
      resume: resumeId,
      level,
      duration,
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
router.post('/:id/start', auth, async (req, res) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, user: req.user._id });
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
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
        duration: interview.duration,
      },
    });
  } catch (error) {
    console.error('Start interview error:', error);
    res.status(500).json({ message: 'Failed to start interview' });
  }
});

// Send user response and get next AI question
router.post('/:id/respond', auth, async (req, res) => {
  try {
    const { userMessage } = req.body;

    if (!userMessage) {
      return res.status(400).json({ message: 'Response is required' });
    }

    const interview = await Interview.findOne({ _id: req.params.id, user: req.user._id });
    if (!interview || interview.status !== 'in_progress') {
      return res.status(400).json({ message: 'Interview not found or not in progress' });
    }

    const resume = await Resume.findById(interview.resume);
    if (!resume) {
      return res.status(410).json({ message: 'The resume for this interview no longer exists' });
    }

    // Add user message to conversation
    interview.conversation.push({
      role: 'user',
      content: userMessage,
    });

    // Calculate remaining time
    const elapsed = (Date.now() - interview.startedAt.getTime()) / 1000 / 60;
    const timeRemaining = Math.max(0, interview.duration - elapsed);

    // Check if time is up
    if (timeRemaining <= 0) {
      interview.status = 'completed';
      interview.endedAt = new Date();
      await interview.save();

      return res.json({
        message: "We've run out of time. Thank you for the interview! Let me prepare your feedback.",
        isComplete: true,
        interviewId: interview._id,
      });
    }

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

    await interview.save();

    res.json({
      message: aiResponse,
      isComplete: false,
      timeRemaining: Math.round(timeRemaining),
    });
  } catch (error) {
    console.error('Respond error:', error);
    res.status(500).json({ message: 'Failed to process response' });
  }
});

// End interview early
router.post('/:id/end', auth, async (req, res) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, user: req.user._id });
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    interview.status = 'ended_early';
    interview.endedAt = new Date();
    await interview.save();

    res.json({
      message: 'Interview ended',
      interviewId: interview._id,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to end interview' });
  }
});

// Generate feedback for completed interview
router.post('/:id/feedback', auth, async (req, res) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, user: req.user._id });
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    if (interview.conversation.length < 2) {
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

    interview.feedback = feedback;
    if (interview.status === 'in_progress') {
      interview.status = 'completed';
      interview.endedAt = new Date();
    }
    await interview.save();

    res.json({ feedback });
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

    res.json({ interview });
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

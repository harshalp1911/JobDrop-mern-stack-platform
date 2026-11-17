const express = require('express');
const pdfParse = require('pdf-parse');
const auth = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { heavyAiLimiter } = require('../middleware/rateLimit');
const validateObjectId = require('../middleware/validateObjectId');
const uploadResume = require('../config/multer');
const Resume = require('../models/Resume');
const { analyzeResume } = require('../services/ai');

const router = express.Router();
router.param('id', validateObjectId);

// Upload resume
router.post('/upload', auth, heavyAiLimiter, uploadResume, asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Please upload a PDF file' });
  }

  // Extract text straight from the in-memory buffer; the PDF is not stored.
  let extractedText = '';
  try {
    const pdfData = await pdfParse(req.file.buffer);
    extractedText = (pdfData.text || '').trim();
  } catch (parseError) {
    return res.status(400).json({ message: 'Could not read this PDF. Please upload a valid, unprotected PDF' });
  }

  if (!extractedText) {
    return res.status(400).json({
      message: 'No text found in this PDF. Scanned or image-only resumes are not supported',
    });
  }

  const resume = new Resume({
    user: req.user._id,
    fileName: req.file.originalname,
    extractedText,
  });

  await resume.save();

  res.status(201).json({
    message: 'Resume uploaded successfully',
    resume: {
      _id: resume._id, // same key the list endpoint uses
      id: resume._id,
      fileName: resume.fileName,
      isAnalyzed: resume.isAnalyzed,
      createdAt: resume.createdAt,
    },
  });
}));

// Analyze resume with AI
router.post('/:id/analyze', auth, heavyAiLimiter, asyncHandler(async (req, res) => {
  const resume = await Resume.findOne({ _id: req.params.id, user: req.user._id });

  if (!resume) {
    return res.status(404).json({ message: 'Resume not found' });
  }

  if (!resume.extractedText) {
    return res.status(400).json({ message: 'No text extracted from resume' });
  }

  const analysis = await analyzeResume(resume.extractedText);

  resume.analysis = analysis;
  resume.isAnalyzed = true;
  await resume.save();

  res.json({
    message: 'Resume analyzed successfully',
    analysis: resume.analysis,
  });
}));

// Get all resumes for user
router.get('/', auth, asyncHandler(async (req, res) => {
  const resumes = await Resume.find({ user: req.user._id })
    .select('-extractedText')
    .sort({ createdAt: -1 });

  res.json({ resumes });
}));

// Get single resume
router.get('/:id', auth, asyncHandler(async (req, res) => {
  const resume = await Resume.findOne({ _id: req.params.id, user: req.user._id })
    .select('-extractedText');

  if (!resume) {
    return res.status(404).json({ message: 'Resume not found' });
  }

  res.json({ resume });
}));

// Delete resume
router.delete('/:id', auth, asyncHandler(async (req, res) => {
  const resume = await Resume.findOneAndDelete({ _id: req.params.id, user: req.user._id });

  if (!resume) {
    return res.status(404).json({ message: 'Resume not found' });
  }

  res.json({ message: 'Resume deleted successfully' });
}));

module.exports = router;

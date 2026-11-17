const express = require('express');
const pdfParse = require('pdf-parse');
const auth = require('../middleware/auth');
const { heavyAiLimiter } = require('../middleware/rateLimit');
const validateObjectId = require('../middleware/validateObjectId');
const uploadResume = require('../config/multer');
const Resume = require('../models/Resume');
const { analyzeResume } = require('../services/ai');

const router = express.Router();
router.param('id', validateObjectId);

// Upload resume
router.post('/upload', auth, heavyAiLimiter, uploadResume, async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Failed to upload resume' });
  }
});

// Analyze resume with AI
router.post('/:id/analyze', auth, heavyAiLimiter, async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ message: 'Failed to analyze resume' });
  }
});

// Get all resumes for user
router.get('/', auth, async (req, res) => {
  try {
    const resumes = await Resume.find({ user: req.user._id })
      .select('-extractedText')
      .sort({ createdAt: -1 });

    res.json({ resumes });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single resume
router.get('/:id', auth, async (req, res) => {
  try {
    const resume = await Resume.findOne({ _id: req.params.id, user: req.user._id })
      .select('-extractedText');

    if (!resume) {
      return res.status(404).json({ message: 'Resume not found' });
    }

    res.json({ resume });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete resume
router.delete('/:id', auth, async (req, res) => {
  try {
    const resume = await Resume.findOneAndDelete({ _id: req.params.id, user: req.user._id });

    if (!resume) {
      return res.status(404).json({ message: 'Resume not found' });
    }

    res.json({ message: 'Resume deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

const mongoose = require('mongoose');
const { DATA_RETENTION_SECONDS } = require('../config/retention');

const resumeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  fileName: {
    type: String,
    required: true,
  },
  extractedText: {
    type: String,
    default: '',
  },
  analysis: {
    summary: { type: String, default: '' },
    skills: [{ type: String }],
    experience: { type: String, default: '' },
    bestFitRole: { type: String, default: '' },
    strengths: [{ type: String }],
    improvements: [{ type: String }],
  },
  isAnalyzed: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

// TTL index: MongoDB deletes the document DATA_RETENTION_DAYS after creation.
resumeSchema.index({ createdAt: 1 }, { expireAfterSeconds: DATA_RETENTION_SECONDS });

module.exports = mongoose.model('Resume', resumeSchema);

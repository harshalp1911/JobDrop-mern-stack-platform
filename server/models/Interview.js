const mongoose = require('mongoose');
const { DATA_RETENTION_SECONDS } = require('../config/retention');

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['ai', 'user'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const interviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  resume: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resume',
    required: true,
  },
  level: {
    type: String,
    enum: ['fresher', 'junior', 'mid', 'senior', 'lead'],
    required: true,
  },
  duration: {
    type: Number,
    required: true,
    enum: [15, 20, 30, 45],
  },
  type: {
    type: String,
    enum: ['technical', 'behavioral', 'mixed'],
    default: 'mixed',
  },
  status: {
    type: String,
    enum: ['setup', 'in_progress', 'completed', 'ended_early'],
    default: 'setup',
  },
  conversation: [messageSchema],
  startedAt: {
    type: Date,
    default: null,
  },
  endedAt: {
    type: Date,
    default: null,
  },
  // Set while an answer is being processed; prevents concurrent /respond calls
  respondingSince: {
    type: Date,
    default: null,
  },
  feedback: {
    overallScore: { type: Number, default: 0 },
    technicalScore: { type: Number, default: 0 },
    communicationScore: { type: Number, default: 0 },
    summary: { type: String, default: '' },
    strengths: [{ type: String }],
    improvements: [{ type: String }],
    questionBreakdown: [{
      question: String,
      userAnswer: String,
      rating: String,
      feedback: String,
    }],
    generatedAt: { type: Date, default: null },
  },
}, { timestamps: true });

// TTL index: MongoDB deletes the document DATA_RETENTION_DAYS after creation.
interviewSchema.index({ createdAt: 1 }, { expireAfterSeconds: DATA_RETENTION_SECONDS });

module.exports = mongoose.model('Interview', interviewSchema);

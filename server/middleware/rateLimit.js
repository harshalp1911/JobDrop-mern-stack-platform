const rateLimit = require('express-rate-limit');

const message = (text) => ({ message: text });

// Login/register/Google: per IP, to slow down password guessing and spam signups
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('Too many attempts. Please try again in 15 minutes'),
});

// Per signed-in user (these run after `auth`, so req.user is set).
// Keeps one user from burning through the shared Groq free-tier quota.
const perUser = (req) => String(req.user._id);

// Interview turns: one answer every few seconds is plenty for a real conversation
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 15,
  keyGenerator: perUser,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('You are sending answers too quickly. Please wait a moment'),
});

// Heavier one-off AI jobs: resume upload/analysis and feedback reports
const heavyAiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  keyGenerator: perUser,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('Hourly limit reached for uploads and AI reports. Please try again later'),
});

module.exports = { authLimiter, aiLimiter, heavyAiLimiter };

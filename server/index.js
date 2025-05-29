// server/index.js
require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const jwt          = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs').promises;
const pdfParse   = require('pdf-parse');
const mammoth    = require('mammoth');
const axios      = require('axios');

const User       = require('./models/User');
const Resume     = require('./models/Resume');
const auth       = require('./middleware/auth');
const { fetchJobs } = require('./services/jobAggregator');

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(
  cors({
    origin:      process.env.FRONTEND_URL,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Multer setup ─────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename:    (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const fileFilter = (req, file, cb) => {
  const ok = /\.(pdf|docx|txt)$/i.test(file.originalname);
  cb(ok ? null : new Error('Invalid file type'), ok);
};
const upload = multer({ storage, fileFilter });

// ─── Passport Google OAuth ────────────────────────────────────────────────────
passport.use(
  new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  `http://localhost:${process.env.PORT}/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ googleId: profile.id });
        if (!user) {
          user = await User.create({
            googleId: profile.id,
            name:     profile.displayName,
            email:    profile.emails[0].value,
          });
        }
        done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  )
);
app.use(passport.initialize());

// ─── Helper: bucket experience ─────────────────────────────────────────────────
function categorizeExp(raw = '') {
  const s = raw.toString().toLowerCase();
  if (!s || s.startsWith('0')) return 'fresher';
  const n = parseInt(s.split('-')[0], 10);
  if (!isNaN(n) && n <= 2) return 'entryLevel';
  return 'experienced';
}

// ─── Routes ────────────────────────────────────────────────────────────────────

// 1) Google OAuth kickoff
app.get(
  '/auth/google',
  passport.authenticate('google', { scope: ['profile','email'] })
);

// 2) OAuth callback → issue JWT cookie
app.get(
  '/auth/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/' }),
  (req, res) => {
    const token = jwt.sign(
      { id: req.user._id, name: req.user.name, email: req.user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res
      .cookie('token', token, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        path:     '/',              // must match how we clear it later
      })
      .redirect(process.env.FRONTEND_URL);
  }
);

// 2.5) Logout route → clears the JWT cookie
app.post('/auth/logout', (_req, res) => {
  res
    .clearCookie('token', {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      path:     '/',
    })
    .json({ message: 'Logged out' });
});

// 3) Health check
app.get('/api/health', (_req, res) =>
  res.json({ status: 'OK', timestamp: Date.now() })
);

// 4) Profile (protected)
app.get('/api/profile', auth, async (req, res) => {
  const user = await User.findById(req.user.id).select('-googleId -__v');
  res.json({
    name:      user.name,
    email:     user.email,
    favorites: user.favorites || []
  });
});

// 5) Upload résumé (protected)
app.post(
  '/api/resumes',
  auth,
  upload.single('resume'),
  async (req, res) => {
    const fileUrl = `${process.env.SERVER_URL.replace(/\/$/, '')}/uploads/${req.file.filename}`;
    const doc = await Resume.create({
      user:         req.user.id,
      url:          fileUrl,
      originalName: req.file.originalname,
      mimeType:     req.file.mimetype,
    });
    res.json(doc);
  }
);

// 6) Extract résumé text (protected)
app.get('/api/resumes/:id/text', auth, async (req, res) => {
  const resume = await Resume.findById(req.params.id);
  if (!resume) return res.status(404).json({ error: 'Not found' });

  if (resume.parsedText) {
    return res.json({ text: resume.parsedText });
  }

  const filePath = path.join(__dirname, 'uploads', path.basename(resume.url));
  const buffer   = await fs.readFile(filePath);
  let text       = '';
  const ext      = path.extname(resume.originalName).toLowerCase();

  if (ext === '.pdf') {
    text = (await pdfParse(buffer)).text;
  } else if (ext === '.docx') {
    text = (await mammoth.extractRawText({ buffer })).value;
  } else {
    text = buffer.toString('utf8');
  }

  resume.parsedText = text;
  await resume.save();
  res.json({ text });
});

// 7) Zero-shot classification (protected)
const domainLabels = [
  'AI/ML',
  'SDE',
  'Front-end',
  'Full-Stack Developer',
  'Backend Developer'
];
app.post('/api/classify', auth, async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });
  try {
    const hfRes = await axios.post(
      'https://api-inference.huggingface.co/models/facebook/bart-large-mnli',
      { inputs: text, parameters: { candidate_labels: domainLabels } },
      {
        headers: {
          Authorization: `Bearer ${process.env.HF_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );
    const suggestions = hfRes.data.labels
      .map((label, i) => ({ domain: label, score: hfRes.data.scores[i] }))
      .filter(s => s.score > 0.01)
      .sort((a, b) => b.score - a.score);
    res.json({ suggestions });
  } catch (err) {
    console.error('HF inference error:', err.message);
    res.status(502).json({ error: 'Domain-classifier error' });
  }
});

// 8) Search jobs + filters (protected)
app.get('/api/jobs', auth, async (req, res) => {
  const domains          = (req.query.domains          || '').split(',').filter(Boolean);
  const location         = req.query.location           || 'India';
  const postedWithin     = req.query.postedWithin       || '7d';
  const jobTypes         = (req.query.jobTypes          || 'fulltime').split(',').filter(Boolean);
  const expLevels        = (req.query.experienceLevels  || '').split(',').filter(Boolean);

  try {
    let jobs = await fetchJobs(domains, location, postedWithin, jobTypes);

    if (expLevels.length) {
      jobs = jobs.filter(j =>
        expLevels.includes(categorizeExp(j.experience))
      );
    }

    res.json({ jobs });
  } catch (err) {
    console.error('Job fetch error:', err.response?.status, err.response?.data);
    res.status(502).json({ error: 'Failed to fetch jobs' });
  }
});

// Favorites CRUD (protected)
// … your existing /api/favorites POST, GET, DELETE …

// ─── Start server ─────────────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Mongo connected');
    app.listen(process.env.PORT, () =>
      console.log(`🚀 Server running at http://localhost:${process.env.PORT}`)
    );
  })
  .catch(err => console.error('❌ Mongo connection error:', err));

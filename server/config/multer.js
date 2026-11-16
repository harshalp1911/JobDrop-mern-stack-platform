const multer = require('multer');

// Resumes are kept in memory only long enough to extract their text.
// The file itself is never written to disk or served back.
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'resume'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Wraps upload.single so Multer errors come back as JSON 400s
// instead of falling through to Express's default HTML 500.
const uploadResume = (req, res, next) => {
  upload.single('resume')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'File is too large. Maximum size is 5MB'
        : 'Only PDF files are allowed';
      return res.status(400).json({ message });
    }
    next(err);
  });
};

module.exports = uploadResume;

const mongoose = require('mongoose');

// An error whose message is safe to show the user, with an HTTP status
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.expose = true;
  }
}

// Express 4 doesn't catch rejected promises from async handlers;
// this forwards them to the error handler below.
const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

// Unknown /api routes get JSON instead of Express's HTML page
const notFound = (req, res) => {
  res.status(404).json({ message: 'Route not found' });
};

// Single place that turns errors into JSON responses
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  // Malformed JSON body or body too large (from express.json)
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Request body is not valid JSON' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body is too large' });
  }

  if (err instanceof mongoose.Error.CastError) {
    return res.status(404).json({ message: 'Not found' });
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const message = Object.values(err.errors).map((e) => e.message).join(', ');
    return res.status(400).json({ message });
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: 'That record already exists' });
  }

  if (err.expose && err.status) {
    return res.status(err.status).json({ message: err.message });
  }

  console.error(`${req.method} ${req.originalUrl} failed:`, err);
  res.status(500).json({ message: 'Something went wrong. Please try again' });
};

module.exports = { HttpError, asyncHandler, notFound, errorHandler };

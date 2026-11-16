const mongoose = require('mongoose');

// router.param handler: a malformed :id can never match a document, so
// answer 404 up front instead of letting Mongoose throw a CastError (500).
const validateObjectId = (req, res, next, id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ message: 'Not found' });
  }
  next();
};

module.exports = validateObjectId;

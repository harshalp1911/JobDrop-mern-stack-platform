const mongoose = require('mongoose');
const ResumeSchema = new mongoose.Schema({
  user:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  url:          String,
  originalName: String,
  mimeType:     String,
  parsedText:   String
});
module.exports = mongoose.model('Resume', ResumeSchema);

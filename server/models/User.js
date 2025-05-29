const mongoose = require('mongoose');
const UserSchema = new mongoose.Schema({
  googleId:  { type: String, required: true, unique: true },
  name:      String,
  email:     String,
  favorites: { type: [Object], default: [] }
});
module.exports = mongoose.model('User', UserSchema);

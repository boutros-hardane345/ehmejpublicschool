const mongoose = require('mongoose');
module.exports = mongoose.model('StudentAccount', new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  className: { type: String, enum: ['Grade 7', 'Grade 8', 'Grade 9'], required: true },
  createdAt: { type: Date, default: Date.now }
}));

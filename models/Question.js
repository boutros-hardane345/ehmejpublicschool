const mongoose = require('mongoose');
module.exports = mongoose.model('Question', new mongoose.Schema({
  studentName: { type: String, required: true },
  className: { type: String, required: true, enum: ['Grade 7', 'Grade 8', 'Grade 9'] },
  question: { type: String, required: true },
  answer: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
}));
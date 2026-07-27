const mongoose = require('mongoose');
module.exports = mongoose.model('Schedule', new mongoose.Schema({
  className: { type: String, required: true, enum: ['Grade 7', 'Grade 8', 'Grade 9'] },
  day: { type: String, required: true, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] },
  period: { type: Number, required: true },
  subject: { type: String, default: '' },
  teacher: { type: String, default: '' },
  room: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
}));

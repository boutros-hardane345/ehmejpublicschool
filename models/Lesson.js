const mongoose = require('mongoose');
module.exports = mongoose.model('Lesson', new mongoose.Schema({
  className: { type: String, required: true, enum: ['Grade 7', 'Grade 8', 'Grade 9'] },
  date: { type: String, required: true },
  topic: { type: String, required: true },
  objectives: { type: String, default: '' },
  activities: { type: String, default: '' },
  materials: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
}));

const mongoose = require('mongoose');
module.exports = mongoose.model('SeatingChart', new mongoose.Schema({
  className: { type: String, required: true, enum: ['Grade 7', 'Grade 8', 'Grade 9'], unique: true },
  rows: { type: Number, default: 4 },
  cols: { type: Number, default: 5 },
  desks: [{
    studentId: { type: mongoose.Schema.Types.ObjectId },
    studentName: { type: String, default: '' },
    row: { type: Number, required: true },
    col: { type: Number, required: true }
  }],
  createdAt: { type: Date, default: Date.now }
}));

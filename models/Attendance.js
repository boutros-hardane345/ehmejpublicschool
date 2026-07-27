const mongoose = require('mongoose');
module.exports = mongoose.model('Attendance', new mongoose.Schema({
  date: { type: String, required: true },
  className: { type: String, required: true, enum: ['Grade 7', 'Grade 8', 'Grade 9'] },
  records: [{
    studentId: { type: mongoose.Schema.Types.ObjectId },
    studentName: { type: String, required: true },
    status: { type: String, enum: ['present', 'absent'], default: 'present' }
  }],
  createdAt: { type: Date, default: Date.now }
}));

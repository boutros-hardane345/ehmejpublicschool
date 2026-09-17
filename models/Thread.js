const mongoose = require('mongoose');
// Private 1-to-1 chat: one thread per student, visible by default, student sees only own
module.exports = mongoose.model('Thread', new mongoose.Schema({
  className: { type: String, enum: ['Grade 7', 'Grade 8', 'Grade 9'], required: true },
  studentAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentAccount' },
  studentName: { type: String, required: true },
  isHiddenByTeacher: { type: Boolean, default: false },
  messages: [{
    senderRole: { type: String, enum: ['student', 'teacher'], required: true },
    senderName: { type: String, required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  updatedAt: { type: Date, default: Date.now }
}));

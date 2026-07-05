const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionIndex: Number,
  answer: String,
  autoCorrect: Boolean,
  teacherOverride: { type: Boolean, default: null }
});

module.exports = mongoose.model('QuizAttempt', new mongoose.Schema({
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  studentName: { type: String, required: true },
  answers: [answerSchema],
  score: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  submittedAt: { type: Date, default: Date.now }
}));

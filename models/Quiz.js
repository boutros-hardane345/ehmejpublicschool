const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  type: { type: String, enum: ['mcq', 'truefalse', 'shortanswer'], required: true },
  options: [String],
  correctIndex: Number,
  correctAnswer: String
});

module.exports = mongoose.model('Quiz', new mongoose.Schema({
  className: { type: String, enum: ['Grade 7', 'Grade 8', 'Grade 9'], required: true },
  title: { type: String, required: true },
  semester: { type: Number, enum: [1, 2, 3, 4] },
  questions: [questionSchema],
  createdAt: { type: Date, default: Date.now }
}));

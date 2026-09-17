const mongoose = require('mongoose');
// Independent yearly DS store for portal display ONLY (decoupled from Grades semester docs).
// One record per student: ds[quota] with null = waiting (—). G7=13, G8=19, G9=10.
module.exports = mongoose.model('YearlyDs', new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, unique: true },
  className: { type: String, enum: ['Grade 7', 'Grade 8', 'Grade 9'], required: true },
  ds: { type: [Number], default: [] },
  updatedAt: { type: Date, default: Date.now }
}));

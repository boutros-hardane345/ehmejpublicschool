const mongoose = require('mongoose');
module.exports = mongoose.model('SemesterConfig', new mongoose.Schema({
  className: { type: String, enum: ['Grade 7', 'Grade 8', 'Grade 9'], required: true },
  semester: { type: Number, enum: [1, 2, 3, 4], required: true },
  dsCount: { type: Number, default: 4, min: 2, max: 4 }
}));

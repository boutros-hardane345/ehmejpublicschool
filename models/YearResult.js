const mongoose = require('mongoose');
module.exports = mongoose.model('YearResult', new mongoose.Schema({
  studentId: {type:mongoose.Schema.Types.ObjectId,ref:'Student',required:true},
  midYearExam: {type:Number,default:0},
  finalYearExam: {type:Number,default:0},
  updatedAt: {type:Date,default:Date.now}
}));
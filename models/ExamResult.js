const mongoose = require('mongoose');
module.exports = mongoose.model('ExamResult', new mongoose.Schema({
  studentId: {type:mongoose.Schema.Types.ObjectId,ref:'Student',required:true},
  midYearExam: {type:Number,default:0,min:0,max:60},
  finalYearExam: {type:Number,default:0,min:0,max:60},
  updatedAt: {type:Date,default:Date.now}
}));
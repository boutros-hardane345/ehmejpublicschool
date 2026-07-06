const mongoose = require('mongoose');
module.exports = mongoose.model('Grade', new mongoose.Schema({
  studentId: {type:mongoose.Schema.Types.ObjectId,ref:'Student',required:true},
  semester: {type:Number,enum:[1,2,3,4,5,6],required:true},
  attendance: {type:Number,default:0},
  ds: {type:[Number],default:[0,0,0]},
  bigExam: {type:Number,default:0},
  rawTotal: {type:Number,default:0},
  final60: {type:Number,default:0}
}));
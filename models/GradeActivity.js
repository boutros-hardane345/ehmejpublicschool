const mongoose = require('mongoose');
module.exports = mongoose.model('GradeActivity', new mongoose.Schema({
  studentName: {type:String,required:true},
  action: {type:String,required:true},
  details: String,
  createdAt: {type:Date,default:Date.now}
}));
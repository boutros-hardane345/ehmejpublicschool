const mongoose = require('mongoose');
module.exports = mongoose.model('Exercise', new mongoose.Schema({
  className: {type:String,enum:['Grade 7','Grade 8','Grade 9'],required:true},
  title: {type:String,required:true},
  description: String,
  semester: {type:Number,enum:[1,2,3,4]},
  fileUrl: String,
  fileType: String,
  createdAt: {type:Date,default:Date.now}
}));
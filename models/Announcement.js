const mongoose = require('mongoose');
module.exports = mongoose.model('Announcement', new mongoose.Schema({
  className: {type:String,enum:['Grade 7','Grade 8','Grade 9'],required:true},
  title: {type:String,required:true},
  content: {type:String,required:true},
  createdAt: {type:Date,default:Date.now}
}));
const mongoose = require('mongoose');
module.exports = mongoose.model('ClassSchedule', new mongoose.Schema({
  className: {type:String,enum:['Grade 7','Grade 8','Grade 9'],required:true},
  day: {type:String,enum:['Monday','Tuesday','Wednesday','Thursday','Friday'],required:true},
  time: {type:String,required:true},
  subject: {type:String,required:true}
}));
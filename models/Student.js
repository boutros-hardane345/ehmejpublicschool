const mongoose = require('mongoose');
module.exports = mongoose.model('Student', new mongoose.Schema({
  name: {type:String,required:true},
  className: {type:String,enum:['Grade 7','Grade 8','Grade 9'],required:true},
  academicYear: {type:String,required:true,default:()=>{const n=new Date(),y=n.getMonth()>=8?n.getFullYear():n.getFullYear()-1;return `${y}-${y+1}`;}},
  createdAt: {type:Date,default:Date.now}
}));
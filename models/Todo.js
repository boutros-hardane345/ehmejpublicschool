const mongoose = require('mongoose');
module.exports = mongoose.model('Todo', new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  dueDate: { type: String, default: '' },
  category: { type: String, default: 'general' },
  completed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}));

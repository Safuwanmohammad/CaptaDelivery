const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  id: Number,
  name: String,
  icon: String,
  color: String,
  iconColor: String,
  items: Number
});

module.exports = mongoose.model('Category', categorySchema);
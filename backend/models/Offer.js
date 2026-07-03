const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  id: Number,
  title: String,
  discount: String,
  code: String,
  bg: String,
  icon: String
});

module.exports = mongoose.model('Offer', offerSchema);
const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  id: Number,
  name: String,
  price: Number,
  quantity: Number,
  image: String
});

const orderSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  items: [orderItemSchema],
  total: Number
});

module.exports = mongoose.model('Order', orderSchema);
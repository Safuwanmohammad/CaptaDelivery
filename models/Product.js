const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  oldPrice: Number,
  discount: String,
  image: String,
  category: String,
  rating: Number,
  weight: String
});

module.exports = mongoose.model('Product', productSchema);
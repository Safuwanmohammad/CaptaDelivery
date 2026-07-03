const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  id: Number,
  name: String,
  price: Number,
  oldPrice: Number,
  discount: String,
  image: String,
  rating: Number,
  weight: String
});

const restaurantSchema = new mongoose.Schema({
  id: Number,
  name: String,
  type: String,
  cuisine: String,
  rating: Number,
  deliveryTime: String,
  minOrder: Number,
  image: String,
  menu: [menuItemSchema]
});

module.exports = mongoose.model('Restaurant', restaurantSchema);
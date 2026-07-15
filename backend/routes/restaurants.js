const express = require('express');
const router = express.Router();
const { getAllRestaurants, getRestaurantById, createRestaurant, updateRestaurant, deleteRestaurant } = require('../controllers/restaurantController');

router.get('/', getAllRestaurants);
router.get('/:id', getRestaurantById);
router.post('/', createRestaurant);
router.put('/:id', updateRestaurant);
router.delete('/:id', deleteRestaurant);

module.exports = router;
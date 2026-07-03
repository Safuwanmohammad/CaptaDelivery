const express = require('express');
const router = express.Router();
const { getAllOrders, createOrder, updateOrderStatus } = require('../controllers/orderController');

router.get('/', getAllOrders);
router.post('/', createOrder);
router.put('/:id', updateOrderStatus);

module.exports = router;
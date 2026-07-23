const express = require('express');
const router = express.Router();
const { getAllOrders, createOrder, updateOrderStatus } = require('../controllers/orderController');

// GET all orders
router.get('/', getAllOrders);

// POST create new order
router.post('/', createOrder);

// PUT update order status
router.put('/:id/status', updateOrderStatus);

// GET single order by ID
router.get('/:id', async (req, res) => {
  try {
    const pool = require('../db');
    const result = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error in GET order by id:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
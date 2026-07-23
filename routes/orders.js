const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get all orders
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders ORDER BY date DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get single order
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    const result = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching order:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create order
router.post('/', async (req, res) => {
  const { 
    order_id, customer_id, items, product_total, delivery_charge, 
    rain_fare, commission_amount, admin_profit, grand_total, 
    payment_method, payment_status, status, delivery_address 
  } = req.body;
  
  try {
    const result = await pool.query(
      `INSERT INTO orders (
        order_id, customer_id, items, product_total, delivery_charge, 
        rain_fare, commission_amount, admin_profit, grand_total, 
        payment_method, payment_status, status, delivery_address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [order_id, customer_id, items, product_total, delivery_charge, 
       rain_fare, commission_amount, admin_profit, grand_total, 
       payment_method, payment_status, status, delivery_address]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating order:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update order status
router.put('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const orderId = parseInt(id);
    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    const result = await pool.query(
      'UPDATE orders SET status=$1 WHERE id=$2 RETURNING *',
      [status, orderId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating order status:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
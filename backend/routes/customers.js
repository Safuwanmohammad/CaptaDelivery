const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get all users (customers)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single user
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { total_orders, total_spent, last_order, blocked } = req.body;
  try {
    const userId = parseInt(id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    let query = 'UPDATE users SET';
    const params = [];
    let paramIndex = 1;
    
    if (blocked !== undefined) {
      query += ` blocked = $${paramIndex},`;
      params.push(blocked);
      paramIndex++;
    }
    if (total_orders !== undefined) {
      query += ` total_orders = $${paramIndex},`;
      params.push(total_orders);
      paramIndex++;
    }
    if (total_spent !== undefined) {
      query += ` total_spent = $${paramIndex},`;
      params.push(total_spent);
      paramIndex++;
    }
    if (last_order !== undefined) {
      query += ` last_order = $${paramIndex},`;
      params.push(last_order);
      paramIndex++;
    }
    
    query = query.slice(0, -1);
    query += ` WHERE id = $${paramIndex} RETURNING *`;
    params.push(userId);
    
    const result = await pool.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Block/unblock user
router.put('/:id/block', async (req, res) => {
  const { id } = req.params;
  const { blocked } = req.body;
  try {
    const userId = parseInt(id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    const result = await pool.query(
      'UPDATE users SET blocked=$1 WHERE id=$2 RETURNING *',
      [blocked, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
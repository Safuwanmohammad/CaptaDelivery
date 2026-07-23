const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET all restaurants
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM restaurants ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('Error in GET restaurants:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET single restaurant by ID
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM restaurants WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error in GET restaurant by id:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET restaurants by category
router.get('/category/:category', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM restaurants WHERE category = $1', [req.params.category]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error in GET restaurants by category:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST create new restaurant
router.post('/', async (req, res) => {
  const { name, category, logo, status } = req.body;
  try {
    if (!name || !category) {
      return res.status(400).json({ error: 'Name and category are required' });
    }
    const result = await pool.query(
      'INSERT INTO restaurants (name, category, logo, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, category, logo || null, status || 'Active']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error in POST restaurant:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT update restaurant
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, category, logo, status } = req.body;
  try {
    if (!name || !category) {
      return res.status(400).json({ error: 'Name and category are required' });
    }
    const result = await pool.query(
      'UPDATE restaurants SET name = $1, category = $2, logo = $3, status = $4 WHERE id = $5 RETURNING *',
      [name, category, logo, status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error in PUT restaurant:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE restaurant
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM restaurants WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    res.json({ success: true, message: 'Restaurant deleted successfully' });
  } catch (err) {
    console.error('Error in DELETE restaurant:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
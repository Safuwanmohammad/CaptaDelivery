const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get all restaurants
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM restaurants ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching restaurants:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get single restaurant
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    const result = await pool.query('SELECT * FROM restaurants WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching restaurant:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create restaurant
router.post('/', async (req, res) => {
  const { name, category, logo, status } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO restaurants (name, category, logo, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, category, logo || 'https://placehold.co/100', status || 'Active']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating restaurant:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update restaurant
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, category, logo, status } = req.body;
  try {
    const restaurantId = parseInt(id);
    if (isNaN(restaurantId)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    const result = await pool.query(
      'UPDATE restaurants SET name=$1, category=$2, logo=$3, status=$4 WHERE id=$5 RETURNING *',
      [name, category, logo, status, restaurantId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating restaurant:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete restaurant
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const restaurantId = parseInt(id);
    if (isNaN(restaurantId)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    await pool.query('DELETE FROM restaurants WHERE id = $1', [restaurantId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting restaurant:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
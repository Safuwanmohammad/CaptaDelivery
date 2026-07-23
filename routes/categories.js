const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get all categories
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get single category
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    const result = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching category:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create category
router.post('/', async (req, res) => {
  const { name, image } = req.body;
  try {
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Category name is required' });
    }
    const result = await pool.query(
      'INSERT INTO categories (name, image) VALUES ($1, $2) RETURNING *',
      [name.trim(), image || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating category:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update category
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, image } = req.body;
  try {
    const categoryId = parseInt(id);
    if (isNaN(categoryId)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Category name is required' });
    }
    const result = await pool.query(
      'UPDATE categories SET name=$1, image=$2 WHERE id=$3 RETURNING *',
      [name.trim(), image || null, categoryId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating category:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete category
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const categoryId = parseInt(id);
    if (isNaN(categoryId)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    await pool.query('DELETE FROM categories WHERE id = $1', [categoryId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting category:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
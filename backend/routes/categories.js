const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET all categories
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('Error in GET categories:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET single category by ID
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error in GET category by id:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST create new category
router.post('/', async (req, res) => {
  const { name, image } = req.body;
  try {
    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    const result = await pool.query(
      'INSERT INTO categories (name, image) VALUES ($1, $2) RETURNING *',
      [name, image || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Category name already exists' });
    }
    console.error('Error in POST category:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT update category
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, image } = req.body;
  try {
    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    const result = await pool.query(
      'UPDATE categories SET name = $1, image = $2 WHERE id = $3 RETURNING *',
      [name, image, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error in PUT category:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE category
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (err) {
    console.error('Error in DELETE category:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
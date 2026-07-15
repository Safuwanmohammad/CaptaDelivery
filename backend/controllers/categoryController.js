const pool = require('../db');

// Get all categories
exports.getAllCategories = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ error: 'Failed to fetch categories', details: err.message });
  }
};

// Create a new category
exports.createCategory = async (req, res) => {
  try {
    const { name, image } = req.body;
    
    // Validate input
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Category name is required' });
    }
    
    // Check if category already exists
    const exists = await pool.query('SELECT id FROM categories WHERE name = $1', [name.trim()]);
    if (exists.rows.length > 0) {
      return res.status(400).json({ error: 'Category already exists' });
    }
    
    const result = await pool.query(
      'INSERT INTO categories (name, image) VALUES ($1, $2) RETURNING *',
      [name.trim(), image || null]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating category:', err);
    res.status(500).json({ error: 'Failed to create category', details: err.message });
  }
};

// Update a category
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, image } = req.body;
    
    // Validate input
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Category name is required' });
    }
    
    // Check if category exists
    const exists = await pool.query('SELECT id FROM categories WHERE id = $1', [id]);
    if (exists.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Check if another category already has this name
    const duplicate = await pool.query(
      'SELECT id FROM categories WHERE name = $1 AND id != $2',
      [name.trim(), id]
    );
    if (duplicate.rows.length > 0) {
      return res.status(400).json({ error: 'Another category with this name already exists' });
    }
    
    const result = await pool.query(
      'UPDATE categories SET name = $1, image = $2 WHERE id = $3 RETURNING *',
      [name.trim(), image || null, id]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating category:', err);
    res.status(500).json({ error: 'Failed to update category', details: err.message });
  }
};

// Delete a category
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if category exists
    const exists = await pool.query('SELECT id FROM categories WHERE id = $1', [id]);
    if (exists.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Check if category is used by any restaurants
    const used = await pool.query('SELECT id FROM restaurants WHERE category = (SELECT name FROM categories WHERE id = $1) LIMIT 1', [id]);
    if (used.rows.length > 0) {
      return res.status(400).json({ error: 'Cannot delete category because it is used by one or more restaurants' });
    }
    
    await pool.query('DELETE FROM categories WHERE id = $1', [id]);
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (err) {
    console.error('Error deleting category:', err);
    res.status(500).json({ error: 'Failed to delete category', details: err.message });
  }
};
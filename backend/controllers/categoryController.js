const pool = require('../db');

// Helper function to check if column exists
async function columnExists(table, column) {
  const result = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = $1 AND column_name = $2
    )
  `, [table, column]);
  return result.rows[0].exists;
}

// Get all categories
exports.getAllCategories = async (req, res) => {
  try {
    console.log('[Categories] Fetching all categories...');
    
    // Check if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'categories'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('[Categories] Table does not exist, creating...');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS categories (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          image TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      return res.json([]);
    }
    
    // Check if image column exists
    const hasImageColumn = await columnExists('categories', 'image');
    const hasImagesColumn = await columnExists('categories', 'images');
    
    let imageField = 'NULL as image';
    if (hasImageColumn) imageField = 'image';
    else if (hasImagesColumn) imageField = 'images as image';
    
    const query = `SELECT id, name, ${imageField}, created_at FROM categories ORDER BY id`;
    const result = await pool.query(query);
    
    console.log(`[Categories] Found ${result.rows.length} categories`);
    res.json(result.rows);
  } catch (err) {
    console.error('[Categories] Error:', err);
    res.status(500).json({ 
      error: 'Failed to fetch categories', 
      details: err.message
    });
  }
};

// Create a new category
exports.createCategory = async (req, res) => {
  try {
    const { name, image } = req.body;
    console.log('[Categories] Creating:', { name });
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Category name is required' });
    }
    
    // Check if image column exists
    const hasImageColumn = await columnExists('categories', 'image');
    const hasImagesColumn = await columnExists('categories', 'images');
    
    let query, values;
    if (hasImageColumn) {
      query = 'INSERT INTO categories (name, image) VALUES ($1, $2) RETURNING *';
      values = [name.trim(), image || null];
    } else if (hasImagesColumn) {
      query = 'INSERT INTO categories (name, images) VALUES ($1, $2) RETURNING *';
      values = [name.trim(), image || null];
    } else {
      query = 'INSERT INTO categories (name) VALUES ($1) RETURNING *';
      values = [name.trim()];
    }
    
    const result = await pool.query(query, values);
    console.log('[Categories] Created:', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[Categories] Create error:', err);
    res.status(500).json({ error: 'Failed to create category', details: err.message });
  }
};

// Update a category
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, image } = req.body;
    console.log('[Categories] Updating:', { id, name });
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Category name is required' });
    }
    
    // Check if category exists
    const checkResult = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Check if image column exists
    const hasImageColumn = await columnExists('categories', 'image');
    const hasImagesColumn = await columnExists('categories', 'images');
    
    let query, values;
    if (hasImageColumn) {
      query = 'UPDATE categories SET name = $1, image = $2 WHERE id = $3 RETURNING *';
      values = [name.trim(), image || null, id];
    } else if (hasImagesColumn) {
      query = 'UPDATE categories SET name = $1, images = $2 WHERE id = $3 RETURNING *';
      values = [name.trim(), image || null, id];
    } else {
      query = 'UPDATE categories SET name = $1 WHERE id = $2 RETURNING *';
      values = [name.trim(), id];
    }
    
    const result = await pool.query(query, values);
    console.log('[Categories] Updated:', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Categories] Update error:', err);
    res.status(500).json({ 
      error: 'Failed to update category', 
      details: err.message
    });
  }
};

// Delete a category
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[Categories] Deleting:', id);
    
    const exists = await pool.query('SELECT id FROM categories WHERE id = $1', [id]);
    if (exists.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    await pool.query('DELETE FROM categories WHERE id = $1', [id]);
    console.log('[Categories] Deleted:', id);
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    console.error('[Categories] Delete error:', err);
    res.status(500).json({ error: 'Failed to delete category', details: err.message });
  }
};
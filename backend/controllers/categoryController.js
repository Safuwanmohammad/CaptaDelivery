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
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Category name is required' });
    }
    
    const exists = await pool.query('SELECT id FROM categories WHERE name = $1', [name.trim()]);
    if (exists.rows.length > 0) {
      return res.status(400).json({ error: 'Category already exists' });
    }
    
    // Check if image column exists, if not, don't include it
    let query = 'INSERT INTO categories (name';
    let values = [name.trim()];
    let paramCount = 2;
    
    if (image !== undefined) {
      query += ', image';
      values.push(image || null);
    }
    
    query += `) VALUES ($1${image !== undefined ? ', $2' : ''}) RETURNING *`;
    
    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating category:', err);
    res.status(500).json({ error: 'Failed to create category', details: err.message });
  }
};

// Update a category - FIXED with fallback
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, image } = req.body;
    
    console.log(`[Category Update] ID: ${id}, Name: ${name}`);
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Category name is required' });
    }
    
    // Check if category exists
    const checkResult = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Check for duplicate name
    const duplicateCheck = await pool.query(
      'SELECT id FROM categories WHERE LOWER(name) = LOWER($1) AND id != $2',
      [name.trim(), id]
    );
    if (duplicateCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Another category with this name already exists' });
    }
    
    // Check if image column exists first
    let hasImageColumn = false;
    try {
      const colCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'categories' AND column_name = 'image'
      `);
      hasImageColumn = colCheck.rows.length > 0;
    } catch (err) {
      console.log('Could not check columns, assuming image column exists');
      hasImageColumn = true;
    }
    
    // Build query based on whether image column exists
    let query, params;
    
    if (hasImageColumn && image !== undefined) {
      // Update with image
      query = 'UPDATE categories SET name = $1, image = $2 WHERE id = $3 RETURNING *';
      params = [name.trim(), image || null, id];
    } else {
      // Update without image (fallback)
      query = 'UPDATE categories SET name = $1 WHERE id = $2 RETURNING *';
      params = [name.trim(), id];
    }
    
    console.log('[Category Update] Query:', query);
    console.log('[Category Update] Params:', params);
    
    const result = await pool.query(query, params);
    
    console.log('[Category Update] Success:', result.rows[0]);
    res.json(result.rows[0]);
    
  } catch (err) {
    console.error('[Category Update] Error:', err);
    
    // If error is about missing column, try without image
    if (err.code === '42703' && err.message.includes('column "image" does not exist')) {
      console.log('[Category Update] Retrying without image column...');
      try {
        const result = await pool.query(
          'UPDATE categories SET name = $1 WHERE id = $2 RETURNING *',
          [req.body.name.trim(), req.params.id]
        );
        console.log('[Category Update] Success (without image):', result.rows[0]);
        return res.json(result.rows[0]);
      } catch (retryErr) {
        console.error('[Category Update] Retry failed:', retryErr);
        return res.status(500).json({ 
          error: 'Failed to update category', 
          details: retryErr.message 
        });
      }
    }
    
    res.status(500).json({ 
      error: 'Failed to update category', 
      details: err.message,
      code: err.code
    });
  }
};

// Delete a category
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    
    const exists = await pool.query('SELECT id FROM categories WHERE id = $1', [id]);
    if (exists.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Check if category is used by restaurants
    const used = await pool.query(
      'SELECT id FROM restaurants WHERE category = (SELECT name FROM categories WHERE id = $1) LIMIT 1',
      [id]
    );
    if (used.rows.length > 0) {
      return res.status(400).json({ error: 'Cannot delete: category is used by restaurants' });
    }
    
    await pool.query('DELETE FROM categories WHERE id = $1', [id]);
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    console.error('Error deleting category:', err);
    res.status(500).json({ error: 'Failed to delete category', details: err.message });
  }
};
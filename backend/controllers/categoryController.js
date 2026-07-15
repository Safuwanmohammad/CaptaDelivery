const pool = require('../db');

// Get all categories
exports.getAllCategories = async (req, res) => {
  try {
    console.log('[Categories] Fetching all categories...');
    
    // First check if categories table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'categories'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('[Categories] Table does not exist, returning empty array');
      return res.json([]);
    }
    
    // Check what columns exist
    const columns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'categories'
    `);
    const existingColumns = columns.rows.map(r => r.column_name);
    console.log('[Categories] Existing columns:', existingColumns);
    
    // Build query with only existing columns
    let selectFields = ['id', 'name'];
    if (existingColumns.includes('image')) selectFields.push('image');
    if (existingColumns.includes('created_at')) selectFields.push('created_at');
    
    const query = `SELECT ${selectFields.join(', ')} FROM categories ORDER BY id`;
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
    
    // Check what columns exist
    const columns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'categories'
    `);
    const existingColumns = columns.rows.map(r => r.column_name);
    
    // Build insert query with only existing columns
    let fields = ['name'];
    let values = [name.trim()];
    let paramCount = 2;
    
    if (existingColumns.includes('image') && image !== undefined) {
      fields.push('image');
      values.push(image || null);
    }
    
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO categories (${fields.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    
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
    
    // Check what columns exist
    const columns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'categories'
    `);
    const existingColumns = columns.rows.map(r => r.column_name);
    
    // Build update query with only existing columns
    let updates = [];
    let values = [];
    let paramCount = 1;
    
    updates.push(`name = $${paramCount++}`);
    values.push(name.trim());
    
    if (existingColumns.includes('image') && image !== undefined) {
      updates.push(`image = $${paramCount++}`);
      values.push(image || null);
    }
    
    values.push(id);
    const query = `UPDATE categories SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    
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
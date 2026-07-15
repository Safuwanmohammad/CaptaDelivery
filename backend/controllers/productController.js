const pool = require('../db');

// Get all products with restaurant details
exports.getAllProducts = async (req, res) => {
  try {
    console.log('[Products] Fetching all products...');
    
    // First check if products table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'products'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('[Products] Table does not exist, returning empty array');
      return res.json([]);
    }
    
    // Check what columns exist
    const columns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products'
    `);
    const existingColumns = columns.rows.map(r => r.column_name);
    console.log('[Products] Existing columns:', existingColumns);
    
    // Build SELECT with only existing columns
    let selectFields = ['id', 'name'];
    if (existingColumns.includes('price')) selectFields.push('price');
    if (existingColumns.includes('category')) selectFields.push('category');
    if (existingColumns.includes('restaurant_id')) selectFields.push('restaurant_id');
    if (existingColumns.includes('commission')) selectFields.push('commission');
    if (existingColumns.includes('status')) selectFields.push('status');
    if (existingColumns.includes('images')) selectFields.push('images');
    if (existingColumns.includes('variants')) selectFields.push('variants');
    if (existingColumns.includes('created_at')) selectFields.push('created_at');
    
    // Also try to get restaurant name (it might not exist in products table)
    const query = `
      SELECT ${selectFields.join(', ')}, 
             r.name as restaurant_name
      FROM products p
      LEFT JOIN restaurants r ON p.restaurant_id = r.id
      ORDER BY p.id
    `;
    
    const result = await pool.query(query);
    
    // Format results safely
    const products = result.rows.map(row => ({
      id: row.id,
      name: row.name || '',
      price: parseFloat(row.price) || 0,
      category: row.category || null,
      restaurant_id: row.restaurant_id || null,
      restaurant_name: row.restaurant_name || null,
      commission: parseFloat(row.commission) || 0,
      status: row.status || 'Active',
      images: row.images || [],
      variants: row.variants || [],
      created_at: row.created_at || null
    }));
    
    console.log(`[Products] Found ${products.length} products`);
    res.json(products);
  } catch (err) {
    console.error('[Products] Error:', err);
    res.status(500).json({ 
      error: 'Failed to fetch products', 
      details: err.message
    });
  }
};

// Get products by category
exports.getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    console.log(`[Products] Fetching for category: ${category}`);
    
    const result = await pool.query(
      `SELECT p.*, r.name as restaurant_name
       FROM products p
       LEFT JOIN restaurants r ON p.restaurant_id = r.id
       WHERE p.category = $1
       ORDER BY p.id`,
      [category]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error('[Products] Category error:', err);
    res.status(500).json({ error: 'Failed to fetch products', details: err.message });
  }
};

// Create a new product
exports.createProduct = async (req, res) => {
  try {
    const { name, category, restaurantId, price, commission, status, images, variants } = req.body;
    console.log('[Products] Creating:', { name, category });
    
    // Validate
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Product name is required' });
    }
    if (!category || category.trim() === '') {
      return res.status(400).json({ error: 'Category is required' });
    }
    if (!price || isNaN(price) || price <= 0) {
      return res.status(400).json({ error: 'Valid price is required' });
    }
    
    // Check what columns exist
    const columns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products'
    `);
    const existingColumns = columns.rows.map(r => r.column_name);
    
    // Build insert with only existing columns
    let fields = ['name', 'category', 'price'];
    let values = [name.trim(), category.trim(), price];
    
    if (existingColumns.includes('restaurant_id')) {
      fields.push('restaurant_id');
      values.push(restaurantId || null);
    }
    if (existingColumns.includes('commission')) {
      fields.push('commission');
      values.push(commission || 0);
    }
    if (existingColumns.includes('status')) {
      fields.push('status');
      values.push(status || 'Active');
    }
    if (existingColumns.includes('images')) {
      fields.push('images');
      values.push(images || []);
    }
    if (existingColumns.includes('variants')) {
      fields.push('variants');
      values.push(variants || []);
    }
    
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO products (${fields.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    
    const result = await pool.query(query, values);
    console.log('[Products] Created:', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[Products] Create error:', err);
    res.status(500).json({ error: 'Failed to create product', details: err.message });
  }
};

// Update a product
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, restaurantId, price, commission, status, images, variants } = req.body;
    console.log('[Products] Updating:', { id, name });
    
    // Validate
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Product name is required' });
    }
    if (!category || category.trim() === '') {
      return res.status(400).json({ error: 'Category is required' });
    }
    if (!price || isNaN(price) || price <= 0) {
      return res.status(400).json({ error: 'Valid price is required' });
    }
    
    // Check if product exists
    const exists = await pool.query('SELECT id FROM products WHERE id = $1', [id]);
    if (exists.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Check what columns exist
    const columns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products'
    `);
    const existingColumns = columns.rows.map(r => r.column_name);
    
    // Build update with only existing columns
    let updates = [];
    let values = [];
    let paramCount = 1;
    
    updates.push(`name = $${paramCount++}`);
    values.push(name.trim());
    
    updates.push(`category = $${paramCount++}`);
    values.push(category.trim());
    
    updates.push(`price = $${paramCount++}`);
    values.push(price);
    
    if (existingColumns.includes('restaurant_id')) {
      updates.push(`restaurant_id = $${paramCount++}`);
      values.push(restaurantId || null);
    }
    if (existingColumns.includes('commission')) {
      updates.push(`commission = $${paramCount++}`);
      values.push(commission || 0);
    }
    if (existingColumns.includes('status')) {
      updates.push(`status = $${paramCount++}`);
      values.push(status || 'Active');
    }
    if (existingColumns.includes('images')) {
      updates.push(`images = $${paramCount++}`);
      values.push(images || []);
    }
    if (existingColumns.includes('variants')) {
      updates.push(`variants = $${paramCount++}`);
      values.push(variants || []);
    }
    
    values.push(id);
    const query = `UPDATE products SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    
    const result = await pool.query(query, values);
    console.log('[Products] Updated:', result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Products] Update error:', err);
    res.status(500).json({ error: 'Failed to update product', details: err.message });
  }
};

// Delete a product
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[Products] Deleting:', id);
    
    const exists = await pool.query('SELECT id FROM products WHERE id = $1', [id]);
    if (exists.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    console.log('[Products] Deleted:', id);
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    console.error('[Products] Delete error:', err);
    res.status(500).json({ error: 'Failed to delete product', details: err.message });
  }
};
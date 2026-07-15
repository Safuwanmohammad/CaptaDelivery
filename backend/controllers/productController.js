const pool = require('../db');

// Get all products with restaurant details - COMPLETE FIX
exports.getAllProducts = async (req, res) => {
  try {
    console.log('[Products] Fetching all products...');
    
    // First check if products table exists
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'products'
      )
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('[Products] Table does not exist, creating...');
      // Create products table if it doesn't exist
      await pool.query(`
        CREATE TABLE IF NOT EXISTS products (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          price NUMERIC(10,2),
          category TEXT,
          restaurant_id INTEGER,
          commission NUMERIC(5,2) DEFAULT 0,
          status TEXT DEFAULT 'Active',
          images TEXT[] DEFAULT '{}',
          variants JSONB DEFAULT '[]',
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
    }
    
    // Get actual columns from the table
    const columnsResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products'
    `);
    
    const existingColumns = columnsResult.rows.map(row => row.column_name);
    console.log('[Products] Existing columns:', existingColumns);
    
    // Build SELECT query dynamically
    let selectFields = ['id', 'name'];
    
    if (existingColumns.includes('price')) selectFields.push('price');
    if (existingColumns.includes('category')) selectFields.push('category');
    if (existingColumns.includes('restaurant_id')) selectFields.push('restaurant_id');
    if (existingColumns.includes('commission')) selectFields.push('commission');
    if (existingColumns.includes('status')) selectFields.push('status');
    if (existingColumns.includes('images')) selectFields.push('images');
    if (existingColumns.includes('variants')) selectFields.push('variants');
    if (existingColumns.includes('created_at')) selectFields.push('created_at');
    
    // Always try to get restaurant name
    const query = `
      SELECT ${selectFields.join(', ')}, 
             r.name as restaurant_name,
             r.category as restaurant_category
      FROM products p
      LEFT JOIN restaurants r ON p.restaurant_id = r.id
      ORDER BY p.id
    `;
    
    console.log('[Products] Query:', query);
    const result = await pool.query(query);
    
    // Transform to consistent format
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
      created_at: row.created_at || new Date().toISOString()
    }));
    
    console.log(`[Products] Found ${products.length} products`);
    res.json(products);
    
  } catch (err) {
    console.error('[Products] Error:', err);
    res.status(500).json({ 
      error: 'Failed to fetch products',
      details: err.message,
      code: err.code
    });
  }
};

// Get products by category
exports.getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    console.log(`[Products] Fetching products for category: ${category}`);
    
    const result = await pool.query(
      `SELECT p.*, 
              r.name as restaurant_name,
              r.category as restaurant_category
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
    console.log('[Products] Creating product:', { name, category, restaurantId, price });
    
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
    
    // Simple insert with all possible columns
    const result = await pool.query(
      `INSERT INTO products (name, category, restaurant_id, price, commission, status, images, variants)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        name.trim(), 
        category.trim(), 
        restaurantId || null, 
        price, 
        commission || 0, 
        status || 'Active', 
        images || [], 
        variants || []
      ]
    );
    
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
    console.log('[Products] Updating product:', { id, name, category });
    
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
    
    // Simple update with all possible columns
    const result = await pool.query(
      `UPDATE products 
       SET name = $1, category = $2, restaurant_id = $3, price = $4, 
           commission = $5, status = $6, images = $7, variants = $8
       WHERE id = $9
       RETURNING *`,
      [
        name.trim(), 
        category.trim(), 
        restaurantId || null, 
        price, 
        commission || 0, 
        status || 'Active', 
        images || [], 
        variants || [],
        id
      ]
    );
    
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
    console.log('[Products] Deleting product:', id);
    
    const exists = await pool.query('SELECT id FROM products WHERE id = $1', [id]);
    if (exists.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    console.log('[Products] Deleted product:', id);
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    console.error('[Products] Delete error:', err);
    res.status(500).json({ error: 'Failed to delete product', details: err.message });
  }
};
const pool = require('../db');

// Helper to parse product variants
function parseProduct(row) {
  return {
    ...row,
    variants: row.variants || [],
    images: row.images || []
  };
}

exports.getAllProducts = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY id DESC');
    const products = result.rows.map(row => parseProduct(row));
    res.json(products);
  } catch (err) {
    console.error('Error in getAllProducts:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getProductsByCategory = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE category = $1', [req.params.category]);
    const products = result.rows.map(row => parseProduct(row));
    res.json(products);
  } catch (err) {
    console.error('Error in getProductsByCategory:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.createProduct = async (req, res) => {
  const { name, category, restaurantId, price, commission, status, images, variants } = req.body;
  
  try {
    // Ensure variants is an array
    const variantsJson = variants && Array.isArray(variants) ? variants : [];
    const imagesJson = images && Array.isArray(images) ? images : [];
    
    console.log('Creating product with variants:', JSON.stringify(variantsJson));
    
    const result = await pool.query(
      `INSERT INTO products (name, category, restaurant_id, price, commission, status, images, variants)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, category, restaurantId, price, commission, status, imagesJson, variantsJson]
    );
    
    const product = parseProduct(result.rows[0]);
    console.log('Product created with variants:', product.variants);
    
    res.status(201).json(product);
  } catch (err) {
    console.error('Error in createProduct:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateProduct = async (req, res) => {
  const { id } = req.params;
  const { name, category, restaurantId, price, commission, status, images, variants } = req.body;
  
  try {
    const variantsJson = variants && Array.isArray(variants) ? variants : [];
    const imagesJson = images && Array.isArray(images) ? images : [];
    
    console.log('Updating product with variants:', JSON.stringify(variantsJson));
    
    const result = await pool.query(
      `UPDATE products SET 
        name=$1, category=$2, restaurant_id=$3, price=$4, commission=$5, status=$6, images=$7, variants=$8
       WHERE id=$9 RETURNING *`,
      [name, category, restaurantId, price, commission, status, imagesJson, variantsJson, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const product = parseProduct(result.rows[0]);
    console.log('Product updated with variants:', product.variants);
    
    res.json(product);
  } catch (err) {
    console.error('Error in updateProduct:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteProduct = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error in deleteProduct:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get product by ID with variants
exports.getProductById = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const product = parseProduct(result.rows[0]);
    res.json(product);
  } catch (err) {
    console.error('Error in getProductById:', err);
    res.status(500).json({ error: err.message });
  }
};
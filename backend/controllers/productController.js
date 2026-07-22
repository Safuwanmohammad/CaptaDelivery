const pool = require('../db');

// Helper: Safely parse JSONB data
function safeParseJSONB(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  if (typeof value === 'object' && value !== null) {
    // If it's an object with numeric keys, convert to array
    const values = Object.values(value);
    if (Array.isArray(values) && values.length > 0) {
      return values;
    }
    return [];
  }
  return [];
}

// Helper: Parse product row
function parseProduct(row) {
  if (!row) return null;
  return {
    ...row,
    variants: safeParseJSONB(row.variants),
    images: safeParseJSONB(row.images)
  };
}

exports.getAllProducts = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY id DESC');
    const products = result.rows.map(row => parseProduct(row));
    
    console.log(`✅ Returning ${products.length} products`);
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

exports.createProduct = async (req, res) => {
  console.log('📦 Creating product with body:', JSON.stringify(req.body, null, 2));
  
  const { name, category, restaurantId, price, commission, status, images, variants } = req.body;
  
  try {
    // Ensure variants is a valid array
    let variantsArray = [];
    if (variants) {
      if (Array.isArray(variants)) {
        variantsArray = variants;
      } else if (typeof variants === 'string') {
        try {
          variantsArray = JSON.parse(variants);
        } catch (e) {
          variantsArray = [];
        }
      } else if (typeof variants === 'object' && variants !== null) {
        variantsArray = Object.values(variants);
      }
    }
    
    // Ensure images is a valid array
    let imagesArray = [];
    if (images) {
      if (Array.isArray(images)) {
        imagesArray = images;
      } else if (typeof images === 'string') {
        try {
          imagesArray = JSON.parse(images);
        } catch (e) {
          imagesArray = [];
        }
      }
    }
    
    console.log(`✅ Creating product with ${variantsArray.length} variants`);
    
    const result = await pool.query(
      `INSERT INTO products (name, category, restaurant_id, price, commission, status, images, variants)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, category, restaurantId || null, price || 0, commission || 0, status || 'Active', imagesArray, JSON.stringify(variantsArray)]
    );
    
    const product = parseProduct(result.rows[0]);
    console.log(`✅ Product created with ${product.variants.length} variants`);
    
    res.status(201).json(product);
  } catch (err) {
    console.error('Error in createProduct:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
};

exports.updateProduct = async (req, res) => {
  const { id } = req.params;
  console.log(`📝 Updating product ${id} with body:`, JSON.stringify(req.body, null, 2));
  
  const { name, category, restaurantId, price, commission, status, images, variants } = req.body;
  
  try {
    // Ensure variants is a valid array
    let variantsArray = [];
    if (variants) {
      if (Array.isArray(variants)) {
        variantsArray = variants;
      } else if (typeof variants === 'string') {
        try {
          variantsArray = JSON.parse(variants);
        } catch (e) {
          variantsArray = [];
        }
      } else if (typeof variants === 'object' && variants !== null) {
        variantsArray = Object.values(variants);
      }
    }
    
    // Ensure images is a valid array
    let imagesArray = [];
    if (images) {
      if (Array.isArray(images)) {
        imagesArray = images;
      } else if (typeof images === 'string') {
        try {
          imagesArray = JSON.parse(images);
        } catch (e) {
          imagesArray = [];
        }
      }
    }
    
    console.log(`✅ Updating product with ${variantsArray.length} variants:`, variantsArray);
    
    // Convert to JSON string for PostgreSQL
    const variantsJson = JSON.stringify(variantsArray);
    const imagesJson = JSON.stringify(imagesArray);
    
    const result = await pool.query(
      `UPDATE products SET 
        name = $1, 
        category = $2, 
        restaurant_id = $3, 
        price = $4, 
        commission = $5, 
        status = $6, 
        images = $7::jsonb, 
        variants = $8::jsonb
       WHERE id = $9 
       RETURNING *`,
      [name, category, restaurantId || null, price || 0, commission || 0, status || 'Active', imagesJson, variantsJson, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const product = parseProduct(result.rows[0]);
    console.log(`✅ Product updated with ${product.variants.length} variants:`, product.variants);
    
    res.json(product);
  } catch (err) {
    console.error('Error in updateProduct:', err);
    console.error('Stack:', err.stack);
    res.status(500).json({ error: err.message, stack: err.stack });
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
const express = require('express');
const router = express.Router();
const { 
  getAllProducts, 
  getProductsByCategory, 
  getProductById,
  createProduct, 
  updateProduct, 
  deleteProduct 
} = require('../controllers/productController');

// ⭐ IMPORTANT: Specific routes MUST come before generic routes
// 1. GET all products
router.get('/', getAllProducts);

// 2. GET products by category - SPECIFIC route first
router.get('/category/:category', getProductsByCategory);

// 3. GET product by ID - GENERIC route last
router.get('/:id', getProductById);

// 4. POST create product
router.post('/', createProduct);

// 5. PUT update product
router.put('/:id', updateProduct);

// 6. DELETE product
router.delete('/:id', deleteProduct);

module.exports = router;
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

// ⭐ IMPORTANT: Specific routes FIRST, generic routes LAST
router.get('/', getAllProducts);  // GET all products
router.get('/category/:category', getProductsByCategory);  // GET by category
router.get('/:id', getProductById);  // GET by ID - must be LAST
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

module.exports = router;
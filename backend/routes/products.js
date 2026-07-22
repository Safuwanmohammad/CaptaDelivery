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

// IMPORTANT: Order matters! Specific routes before generic ones
router.get('/', getAllProducts);
router.get('/category/:category', getProductsByCategory);
router.get('/:id', getProductById);  // This should be after specific routes
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

module.exports = router;
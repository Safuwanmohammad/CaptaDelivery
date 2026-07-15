const express = require('express');
const router = express.Router();
const { 
  getAllProducts, 
  getProductsByCategory, 
  createProduct, 
  updateProduct, 
  deleteProduct 
} = require('../controllers/productController');

// GET all products
router.get('/', getAllProducts);

// GET products by category
router.get('/category/:category', getProductsByCategory);

// POST create product
router.post('/', createProduct);

// PUT update product
router.put('/:id', updateProduct);

// DELETE product
router.delete('/:id', deleteProduct);

module.exports = router;
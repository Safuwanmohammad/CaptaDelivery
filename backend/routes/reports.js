const express = require('express');
const router = express.Router();
const {
  getCommissionReport,
  getRestaurantReport,
  toggleRestaurantStatus,
  getCategoryCommissionReport
} = require('../controllers/reportController');

router.get('/commission', getCommissionReport);
router.get('/restaurant/:id', getRestaurantReport);
router.put('/restaurant/:id/toggle', toggleRestaurantStatus);
router.get('/category-commission', getCategoryCommissionReport); // NEW

module.exports = router;
const express = require('express');
const router = express.Router();
const { getAllOffers } = require('../controllers/offerController');

router.get('/', getAllOffers);

module.exports = router;
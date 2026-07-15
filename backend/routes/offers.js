const express = require('express');
const router = express.Router();
const { getAllOffers, createOffer, updateOffer, deleteOffer } = require('../controllers/offerController');

router.get('/', getAllOffers);
router.post('/', createOffer);
router.put('/:id', updateOffer);
router.delete('/:id', deleteOffer);

module.exports = router;
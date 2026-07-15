const express = require('express');
const router = express.Router();
const { getAllPlaces, createPlace, updatePlace, deletePlace } = require('../controllers/placeController');

router.get('/', getAllPlaces);
router.post('/', createPlace);
router.put('/:id', updatePlace);
router.delete('/:id', deletePlace);

module.exports = router;
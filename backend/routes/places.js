const express = require('express');
const router = express.Router();
const {
  getAllPlaces,
  createPlace,
  updatePlace,
  deletePlace
} = require('../controllers/placeController');

// GET all delivery places
router.get('/', getAllPlaces);

// POST create a new place
router.post('/', createPlace);

// PUT update a place by ID
router.put('/:id', updatePlace);

// DELETE a place by ID
router.delete('/:id', deletePlace);

module.exports = router;
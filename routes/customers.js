const express = require('express');
const router = express.Router();
const { getAllUsers, updateUser } = require('../controllers/userController');

// GET all customers
router.get('/', getAllUsers);

// PUT update a customer (e.g., block/unblock)
router.put('/:id', updateUser);

module.exports = router;
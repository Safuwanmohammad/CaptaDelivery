const express = require('express');
const router = express.Router();
const { getAllUsers, updateUser } = require('../controllers/userController');

router.get('/', getAllUsers);
router.put('/:id', updateUser);

module.exports = router;
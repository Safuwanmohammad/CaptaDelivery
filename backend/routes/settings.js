const express = require('express');
const router = express.Router();
const { getSettings, updateSetting } = require('../controllers/settingsController');

// GET all settings
router.get('/', getSettings);

// PUT update a specific setting
router.put('/', updateSetting);

module.exports = router;   // <-- this is critical
const express = require('express');
const router = express.Router();
const { getSettings, updateSetting } = require('../controllers/settingsController');

router.get('/', getSettings);
router.put('/', updateSetting);

// ✅ Ensure this is correct
module.exports = router;
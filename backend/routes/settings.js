const express = require('express');
const router = express.Router();
const { getSettings, updateSetting } = require('../controllers/settingsController');

router.get('/', getSettings);
router.put('/', updateSetting);

module.exports = router;
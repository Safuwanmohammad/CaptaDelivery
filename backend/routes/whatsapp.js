const express = require('express');
const router = express.Router();
const { getWhatsAppLogs } = require('../controllers/whatsappController');

router.get('/logs', getWhatsAppLogs);

module.exports = router;
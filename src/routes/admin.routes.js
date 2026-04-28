const express = require('express');
const { getAdminDashboard, saveScreeningResult } = require('../controllers/admin.controller');

const router = express.Router();

router.get('/dashboard', getAdminDashboard);
router.post('/screenings', saveScreeningResult);

module.exports = router;

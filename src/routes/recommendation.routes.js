const express = require('express');
const {
  getPublicRecommendations,
  getAdminRecommendations,
  upsertRecommendation,
} = require('../controllers/admin.controller');

const router = express.Router();

router.get('/', getPublicRecommendations);
router.get('/admin', getAdminRecommendations);
router.put('/admin/:level', upsertRecommendation);

module.exports = router;
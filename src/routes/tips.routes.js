const express = require('express');
const {
  getAllTips,
  getTipsByCategory,
  getAdminTips,
  createTip,
  updateTip,
  deleteTip,
} = require('../controllers/tips.controller');

const router = express.Router();

// Public endpoints
router.get('/', getAllTips);
router.get('/category', getTipsByCategory);

// Admin endpoints
router.post('/admin/create', createTip);
router.put('/admin/update/:id', updateTip);
router.delete('/admin/delete/:id', deleteTip);
router.get('/admin/all', getAdminTips);

module.exports = router;

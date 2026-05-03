const express = require('express');
const {
  getAllMusik,
  getMusikByCategory,
  getAdminMusik,
  createMusik,
  updateMusik,
  deleteMusik,
} = require('../controllers/musik.controller');

const router = express.Router();

// Public routes
router.get('/', getAllMusik);
router.get('/category', getMusikByCategory);

// Admin routes
router.post('/admin/create', createMusik);
router.put('/admin/update/:id', updateMusik);
router.delete('/admin/delete/:id', deleteMusik);
router.get('/admin/all', getAdminMusik);

module.exports = router;

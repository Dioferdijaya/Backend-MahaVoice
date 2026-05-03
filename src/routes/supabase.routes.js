const express = require('express');
const {
	getSupabaseStatus,
	loginUser,
	registerUser,
	updateProfile,
	changePassword,
} = require('../controllers/supabase.controller');

const router = express.Router();

router.get('/status', getSupabaseStatus);
router.post('/login', loginUser);
router.post('/register', registerUser);
router.post('/update-profile', updateProfile);
router.post('/change-password', changePassword);

module.exports = router;
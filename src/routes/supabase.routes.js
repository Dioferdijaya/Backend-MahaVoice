const express = require('express');
const {
	getSupabaseStatus,
	loginUser,
	registerUser,
} = require('../controllers/supabase.controller');

const router = express.Router();

router.get('/status', getSupabaseStatus);
router.post('/login', loginUser);
router.post('/register', registerUser);

module.exports = router;
const express = require('express');
const healthRoutes = require('./health.routes');
const adminRoutes = require('./admin.routes');
const supabaseRoutes = require('./supabase.routes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/admin', adminRoutes);
router.use('/supabase', supabaseRoutes);

module.exports = router;
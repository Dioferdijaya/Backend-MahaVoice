const express = require('express');
const healthRoutes = require('./health.routes');
const adminRoutes = require('./admin.routes');
const supabaseRoutes = require('./supabase.routes');
const chatRoutes = require('./chat.routes');
const screeningRoutes = require('./screening.routes');
const recommendationRoutes = require('./recommendation.routes');
const musikRoutes = require('./musik.routes');
const tipsRoutes = require('./tips.routes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/admin', adminRoutes);
router.use('/supabase', supabaseRoutes);
router.use('/chat', chatRoutes);
router.use('/screening', screeningRoutes);
router.use('/recommendations', recommendationRoutes);
router.use('/musik', musikRoutes);
router.use('/tips', tipsRoutes);

module.exports = router;
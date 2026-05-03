const express = require('express');
const { getPublicScreeningQuestions, getUserScreeningHistory } = require('../controllers/admin.controller');

const router = express.Router();

router.get('/questions', getPublicScreeningQuestions);
router.get('/history', getUserScreeningHistory);

module.exports = router;
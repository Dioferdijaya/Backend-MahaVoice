const express = require('express');
const {
	getAdminDashboard,
	saveScreeningResult,
	getAdminScreeningQuestions,
	createScreeningQuestion,
	updateScreeningQuestion,
	deleteScreeningQuestion,
	getAdminScreeningResults,
	getAdminUsers,
} = require('../controllers/admin.controller');

const router = express.Router();

router.get('/dashboard', getAdminDashboard);
router.post('/screenings', saveScreeningResult);
router.get('/screening-results', getAdminScreeningResults);
router.get('/users', getAdminUsers);
router.get('/screening-questions', getAdminScreeningQuestions);
router.post('/screening-questions', createScreeningQuestion);
router.put('/screening-questions/:id', updateScreeningQuestion);
router.delete('/screening-questions/:id', deleteScreeningQuestion);

module.exports = router;

const express = require('express');
const {
  getChatHistory,
  sendChatMessage,
} = require('../controllers/chat.controller');

const router = express.Router();

router.get('/history', getChatHistory);
router.post('/message', sendChatMessage);

module.exports = router;
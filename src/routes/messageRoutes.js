const express = require('express');
const router = express.Router();

// Import your message controller
const {
    sendMessage,
    getMessages
} = require('../controllers/messageController');

// Import the authentication and role checking middleware
const authenticateTokenAndRole = require('../middleware/authenticateTokenAndRole');

// Route to send a new message
router.post('/', authenticateTokenAndRole(['clients', 'lawyers', 'admins']), sendMessage);

// Route to get all messages in a conversation
router.get('/:conversationId', authenticateTokenAndRole(['clients', 'lawyers', 'admins']), getMessages);

module.exports = router;

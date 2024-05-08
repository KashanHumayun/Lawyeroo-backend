const express = require('express');
const router = express.Router();
const authenticateTokenAndRole = require('../middleware/authenticateTokenAndRole'); // Middleware for authentication and role checks

// Controller imports for lawyer comments and replies
const {
    createLawyerComment,
    getCommentsByClientId,
    createLawyerCommentReply,
    getRepliesByCommentId,
    deleteLawyerComment,
    getCommentsAndRepliesByLawyerId,
    deleteLawyerCommentReply
} = require('../controllers/lawyerCommentController');

// Routes for creating, fetching, and managing lawyer comments and replies

// Create a new lawyer comment
router.post('/',authenticateTokenAndRole(['clients','admins']),  createLawyerComment);

// Get all comments for a specific client
router.get('/client/:client_id', authenticateTokenAndRole(['clients', 'lawyers', 'admins']), getCommentsByClientId);

// Create a reply to a lawyer comment
router.post('/replies',  authenticateTokenAndRole(['lawyers', 'admins']), createLawyerCommentReply);

// Get all replies for a specific comment
router.get('/replies/:comment_id',  authenticateTokenAndRole(['clients', 'lawyers', 'admins']), getRepliesByCommentId);

// Delete a lawyer comment and all related replies
router.delete('/:comment_id', authenticateTokenAndRole(['clients', 'lawyers', 'admins']), deleteLawyerComment);

// Get all comments and their replies for a specific lawyer, including client data
router.get('/lawyer/:lawyer_id', authenticateTokenAndRole(['clients', 'lawyers', 'admins']), getCommentsAndRepliesByLawyerId);

// Delete a reply to a lawyer comment
router.delete('/:comment_id/replies/:reply_id', authenticateTokenAndRole(['lawyers', 'admins']), deleteLawyerCommentReply);

module.exports = router;
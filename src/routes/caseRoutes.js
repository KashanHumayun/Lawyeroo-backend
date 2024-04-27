const express = require('express');
const router = express.Router();

// Import your case controller
const {
    addCase,
    updateCase,
    deleteCase,
    getCase,
    getAllCasesByUserId
} = require('../controllers/caseController');

// Import the authentication and role checking middleware
const authenticateTokenAndRole = require('../middleware/authenticateTokenAndRole');

// Route to add a new case
router.post('/cases', authenticateTokenAndRole(['clients', 'lawyers', 'admins']), addCase);

// Route to update an existing case
router.put('/cases/:case_id', authenticateTokenAndRole(['lawyers', 'admins']), updateCase);

// Route to delete a case
router.delete('/cases/:case_id', authenticateTokenAndRole(['lawyers', 'admins']), deleteCase);

// Route to get a specific case by ID
router.get('/cases/:case_id', authenticateTokenAndRole(['clients', 'lawyers', 'admins']), getCase);

// Route to get all cases by user ID
router.get('/cases/user/:role/:user_id', authenticateTokenAndRole(['clients', 'lawyers', 'admins']), getAllCasesByUserId);

module.exports = router;

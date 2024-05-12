const express = require('express');
const router = express.Router();
const authenticateTokenAndRole = require('../middleware/authenticateTokenAndRole'); // Ensure the path is correct
// Import the controller functions
const {
    createQuestion,
    createAnswer,
    getAllQuestionsWithAnswers,
    getQuestionsByClientId,
    deleteQuestion,
    deleteAnswer
} = require('../controllers/questionController');  // Adjust the path as necessary
// Route to create a new question, accessible only by clients

router.post('/', authenticateTokenAndRole(['clients', 'admins']), createQuestion);
// Route to create a new answer, accessible only by lawyers

router.post('/answers', authenticateTokenAndRole(['clients', 'lawyers']), createAnswer);
// Route to get all questions with their answers, accessible by both clients and lawyers

router.get('/', authenticateTokenAndRole(['clients', 'lawyers']), getAllQuestionsWithAnswers);
// Route to get questions by client ID, accessible only by clients

router.get('/client/:client_id', authenticateTokenAndRole(['clients','admins']), getQuestionsByClientId);
//Route to delete questions by question ID, accessible only by clients

router.delete('/:question_id', authenticateTokenAndRole(['clients','admins']), deleteQuestion);

router.delete('/:question_id/answers/:answer_id', authenticateTokenAndRole(['lawyers', 'admins']), deleteAnswer);

module.exports = router;

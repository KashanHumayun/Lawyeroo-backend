// questionController.js
const { ref, push, set, get, child } = require('firebase/database');
const {database} = require('../config/firebaseConfig');
const logger = require('../utils/logger');


exports.createQuestion = async (req, res) => {
    const { client_id, question_title, question_text } = req.body;

    // Log the attempt to create a new question
    logger.info("Attempt to create a new question", { client_id, question_title });

    // Validate input for title and text
    if (!question_title || !question_text) {
        logger.warn("Validation failed: Question title and text are required.", { client_id });
        return res.status(400).json({ success: false, message: "Question title and text are required." });
    }

    try {
        console.log("Fetching client with ID:", client_id);
        logger.debug("Fetching client", { client_id });

        // Reference to the clients in the database
        const clientRef = ref(database, `clients/${client_id}`);
        const clientSnapshot = await get(clientRef);

        // Check if the client exists
        if (!clientSnapshot.exists()) {
            logger.warn("No client found", { client_id });
            return res.status(404).json({ success: false, message: "Client not found" });
        }

        // If client exists, proceed to create a new question
        const newQuestionRef = push(ref(database, 'questions'));
        const newQuestion = {
            client_id,
            question_title,
            question_text,
            askedAt: new Date().toISOString()  
        };

        await set(newQuestionRef, newQuestion);
        logger.info("Question created successfully", { client_id, question_id: newQuestionRef.key });
        res.status(201).json({ success: true, data: newQuestion });
    } catch (error) {
        logger.error("Error creating question", { client_id, error: error.message });
        res.status(400).json({ success: false, message: error.message });
    }
};



// Create an answer
// Create an answer
exports.createAnswer = async (req, res) => {
    const { question_id, lawyer_id, lawyer_text } = req.body;

    // Log the attempt to create a new answer
    logger.info("Attempt to create a new answer", { question_id, lawyer_id });

    try {
        // Check if the lawyer exists
        const lawyerRef = ref(database, `lawyers/${lawyer_id}`);
        const lawyerSnapshot = await get(lawyerRef);
        if (!lawyerSnapshot.exists()) {
            logger.warn("Lawyer not found", { lawyer_id });
            return res.status(404).json({ success: false, message: "Lawyer not found" });
        }

        // Create a new answer reference under the specific question
        const answerRef = ref(database, `answers/${question_id}`);
        const newAnswerRef = push(answerRef);
        const repliedAt = new Date().toISOString();  // Using ISO string for the timestamp
        await set(newAnswerRef, {
            lawyer_id,
            lawyer_text,
            repliedAt
        });

        logger.info("Answer created successfully", { question_id, lawyer_id, answer_id: newAnswerRef.key });
        res.status(201).json({ success: true, data: { id: newAnswerRef.key, lawyer_id, lawyer_text, repliedAt }});
    } catch (error) {
        logger.error("Error creating answer", { question_id, lawyer_id, error: error.message });
        res.status(400).json({ success: false, message: error.message });
    }
};



exports.getAnswersByQuestionId = async (req, res) => {
    const question_id = req.params.question_id; // Extract question ID from request parameters

    logger.info("Fetching answers", { question_id }); // Log the action with the specific question ID

    try {
        const answersRef = ref(database, `answers/${question_id}`);
        const answersSnapshot = await get(answersRef);

        if (!answersSnapshot.exists()) {
            logger.warn("No answers found", { question_id }); // Log if no answers are found
            return res.status(404).json({ success: false, message: 'No answers found for this question' });
        }

        const answers = answersSnapshot.val(); // Retrieve the answers data
        logger.info("Answers retrieved successfully", { question_id, count: Object.keys(answers).length }); // Log the count of answers retrieved
        res.status(200).json({ success: true, data: answers });
    } catch (error) {
        logger.error("Failed to retrieve answers", { question_id, error: error.message }); // Log the error
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getAllQuestionsWithAnswers = async (req, res) => {
    logger.info("Attempting to fetch all questions with answers");
    try {
        const questionsRef = ref(database, 'questions');
        const questionsSnapshot = await get(questionsRef);
        const questions = questionsSnapshot.val();
        const allQuestions = {};

        if (questions) {
            for (const question_id in questions) {
                const singleQuestion = {...questions[question_id], answers: {}};

                const clientRef = ref(database, `clients/${questions[question_id].client_id}`);
                const clientSnapshot = await get(clientRef);
                if (clientSnapshot.exists()) {
                    singleQuestion.client = clientSnapshot.val();
                }

                const answersRef = ref(database, `answers/${question_id}`);
                const answersSnapshot = await get(answersRef);
                if (answersSnapshot.exists()) {
                    const answers = answersSnapshot.val();
                    for (const answer_id in answers) {
                        const lawyerRef = ref(database, `lawyers/${answers[answer_id].lawyer_id}`);
                        const lawyerSnapshot = await get(lawyerRef);
                        if (lawyerSnapshot.exists()) {
                            answers[answer_id].lawyer = lawyerSnapshot.val();
                        }
                    }
                    singleQuestion.answers = answers;
                }
                allQuestions[question_id] = singleQuestion;
            }
            logger.info("Successfully fetched all questions with their respective answers");
        } else {
            logger.warn("No questions found in database");
        }

        res.status(200).json({ success: true, data: allQuestions });
    } catch (error) {
        logger.error("Failed to retrieve all questions and answers", { error: error.message });
        res.status(500).json({ success: false, message: error.message });
    }
};


exports.getQuestionsByClientId = async (req, res) => {
    const { client_id } = req.params;
    logger.info("Fetching questions for client", { client_id });
    try {
        const questionsRef = ref(database, 'questions');
        const questionsSnapshot = await get(questionsRef);
        const questions = questionsSnapshot.val();
        const clientQuestions = {};

        if (questions) {
            for (const question_id in questions) {
                if (questions[question_id].client_id === client_id) {
                    const singleQuestion = {...questions[question_id], answers: {}};

                    const answersRef = ref(database, `answers/${question_id}`);
                    const answersSnapshot = await get(answersRef);
                    if (answersSnapshot.exists()) {
                        const answers = answersSnapshot.val();
                        for (const answer_id in answers) {
                            const lawyerRef = ref(database, `lawyers/${answers[answer_id].lawyer_id}`);
                            const lawyerSnapshot = await get(lawyerRef);
                            if (lawyerSnapshot.exists()) {
                                answers[answer_id].lawyer = lawyerSnapshot.val();
                            }
                        }
                        singleQuestion.answers = answers;
                    }
                    clientQuestions[question_id] = singleQuestion;
                }
            }
            logger.info("Questions retrieved for client", { client_id });
        } else {
            logger.warn("No questions found for the specified client", { client_id });
        }

        res.status(200).json({ success: true, data: clientQuestions });
    } catch (error) {
        logger.error("Error retrieving questions by client ID", { client_id, error: error.message });
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteQuestion = async (req, res) => {
    const { question_id } = req.params;
    logger.info("Attempting to delete question and its answers", { question_id });

    try {
        const questionRef = ref(database, `questions/${question_id}`);
        const questionSnapshot = await get(questionRef);
        if (!questionSnapshot.exists()) {
            logger.warn("Question not found for deletion", { question_id });
            return res.status(404).json({ success: false, message: "Question not found" });
        }

        await set(questionRef, null);
        const answersRef = ref(database, `answers/${question_id}`);
        const answersSnapshot = await get(answersRef);
        if (answersSnapshot.exists()) {
            await set(answersRef, null);
        }

        logger.info("Successfully deleted question and its answers", { question_id });
        res.status(200).json({ success: true, message: "Question and all related answers have been deleted successfully." });
    } catch (error) {
        logger.error("Error deleting question and answers", { question_id, error: error.message });
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteAnswer = async (req, res) => {
    const { question_id, answer_id } = req.params;
    logger.info("Attempting to delete answer", { question_id, answer_id });

    try {
        const answerRef = ref(database, `answers/${question_id}/${answer_id}`);
        const answerSnapshot = await get(answerRef);
        if (!answerSnapshot.exists()) {
            logger.warn("Answer not found for deletion", { question_id, answer_id });
            return res.status(404).json({ success: false, message: "Answer not found" });
        }

        await set(answerRef, null);
        logger.info("Successfully deleted answer", { question_id, answer_id });
        res.status(200).json({ success: true, message: "Answer has been deleted successfully." });
    } catch (error) {
        logger.error("Error deleting answer", { question_id, answer_id, error: error.message });
        res.status(500).json({ success: false, message: error.message });
    }
};

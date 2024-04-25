// questionController.js
const { ref, push, set, get, child } = require('firebase/database');
const {database} = require('../config/firebaseConfig');


// Create a new question only if the client exists
exports.createQuestion = async (req, res) => {
    try {
        const { client_id, question_title, question_text } = req.body;

        // Validate input for title and text
        if (!question_title || !question_text) {
            return res.status(400).json({ success: false, message: "Question title and text are required." });
        }

        console.log("Fetching client with ID:", client_id);

        // Reference to the clients in the database
        const clientRef = ref(database, `clients/${client_id}`);
        const clientSnapshot = await get(clientRef);

        // Check if the client exists
        if (!clientSnapshot.exists()) {
            console.log("No client found for ID:", client_id);
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
        res.status(201).json({ success: true, data: newQuestion });
    } catch (error) {
        console.error("Error creating question:", error);
        res.status(400).json({ success: false, message: error.message });
    }
};


// Create an answer
// Create an answer
exports.createAnswer = async (req, res) => {
    const { question_id, lawyer_id, lawyer_text } = req.body;
    try {
        // Check if the lawyer exists
        const lawyerRef = ref(database, `lawyers/${lawyer_id}`);
        const lawyerSnapshot = await get(lawyerRef);
        if (!lawyerSnapshot.exists()) {
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

        res.status(201).json({ success: true, data: { id: newAnswerRef.key, lawyer_id, lawyer_text, repliedAt }});
    } catch (error) {
        console.error("Error creating answer:", error);
        res.status(400).json({ success: false, message: error.message });
    }
};



// Get all answers for a question
exports.getAnswersByQuestionId = async (req, res) => {
    try {
        const answersRef = ref(database, `answers/${req.params.question_id}`);
        const answersSnapshot = await get(answersRef);
        if (!answersSnapshot.exists()) {
            return res.status(404).json({ success: false, message: 'No answers found for this question' });
        }
        const answers = answersSnapshot.val();
        res.status(200).json({ success: true, data: answers });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};



exports.getAllQuestionsWithAnswers = async (req, res) => {
    try {
        // Fetch all questions
        const questionsRef = ref(database, 'questions');
        const questionsSnapshot = await get(questionsRef);
        const questions = questionsSnapshot.val();
        const allQuestions = {};

        if (questions) {
            for (const question_id in questions) {
                const singleQuestion = {...questions[question_id], answers: {}};

                // Fetch client data for each question
                const clientRef = ref(database, `clients/${questions[question_id].client_id}`);
                const clientSnapshot = await get(clientRef);
                if (clientSnapshot.exists()) {
                    singleQuestion.client = clientSnapshot.val();  // Add client data to question
                }

                // Fetch answers for each question
                const answersRef = ref(database, `answers/${question_id}`);
                const answersSnapshot = await get(answersRef);
                if (answersSnapshot.exists()) {
                    const answers = answersSnapshot.val();
                    for (const answer_id in answers) {
                        // Fetch lawyer data for each answer
                        const lawyerRef = ref(database, `lawyers/${answers[answer_id].lawyer_id}`);
                        const lawyerSnapshot = await get(lawyerRef);
                        if (lawyerSnapshot.exists()) {
                            answers[answer_id].lawyer = lawyerSnapshot.val();  // Add lawyer data to answer
                        }
                    }
                    singleQuestion.answers = answers;  // Add answers to question
                }
                allQuestions[question_id] = singleQuestion;  // Collect all enriched questions
            }
        }

        res.status(200).json({ success: true, data: allQuestions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


exports.getQuestionsByClientId = async (req, res) => {
    const { client_id } = req.params; // Assuming you pass client_id as a route parameter
    try {
        // Fetch all questions
        const questionsRef = ref(database, 'questions');
        const questionsSnapshot = await get(questionsRef);
        const questions = questionsSnapshot.val();
        const clientQuestions = {};

        if (questions) {
            for (const question_id in questions) {
                if (questions[question_id].client_id === client_id) {
                    const singleQuestion = {...questions[question_id], answers: {}};

                    // Fetch answers for each filtered question
                    const answersRef = ref(database, `answers/${question_id}`);
                    const answersSnapshot = await get(answersRef);
                    if (answersSnapshot.exists()) {
                        const answers = answersSnapshot.val();
                        for (const answer_id in answers) {
                            // Fetch lawyer data for each answer
                            const lawyerRef = ref(database, `lawyers/${answers[answer_id].lawyer_id}`);
                            const lawyerSnapshot = await get(lawyerRef);
                            if (lawyerSnapshot.exists()) {
                                answers[answer_id].lawyer = lawyerSnapshot.val(); // Add lawyer data to answer
                            }
                        }
                        singleQuestion.answers = answers; // Add answers to question
                    }
                    clientQuestions[question_id] = singleQuestion; // Collect all relevant questions
                }
            }
        }

        res.status(200).json({ success: true, data: clientQuestions });
    } catch (error) {
        console.error("Error retrieving questions by client ID:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};


// Delete a question and all related answers
exports.deleteQuestion = async (req, res) => {
    const { question_id } = req.params; // Assuming question_id is passed as a URL parameter

    try {
        // Reference to the specific question
        const questionRef = ref(database, `questions/${question_id}`);
        // Check if the question exists
        const questionSnapshot = await get(questionRef);
        if (!questionSnapshot.exists()) {
            return res.status(404).json({ success: false, message: "Question not found" });
        }

        // Delete the question
        await set(questionRef, null);

        // Reference to the answers associated with the question
        const answersRef = ref(database, `answers/${question_id}`);
        const answersSnapshot = await get(answersRef);

        // Check if there are answers and delete them
        if (answersSnapshot.exists()) {
            await set(answersRef, null);
        }

        res.status(200).json({ success: true, message: "Question and all related answers have been deleted successfully." });
    } catch (error) {
        console.error("Error deleting question and answers:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

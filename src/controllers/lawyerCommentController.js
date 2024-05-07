const { ref, push, set, get, child } = require('firebase/database');
const { database } = require('../config/firebaseConfig');
const logger = require('../utils/logger');
const lawyer_interactions = require('../utils/lawyerInteraction');

// Create a lawyer comment
exports.createLawyerComment = async (req, res) => {
    try {
        const { client_id, lawyer_id, comment_text } = req.body;

        if (!comment_text) {
            logger.warn('Attempt to submit an empty comment.');
            return res.status(400).json({ success: false, message: "Comment text is required." });
        }

        // Check if client exists
        const clientRef = ref(database, `clients/${client_id}`);
        const clientSnapshot = await get(clientRef);
        if (!clientSnapshot.exists()) {
            logger.warn(`Client not found: ${client_id}`);
            return res.status(404).json({ success: false, message: "Client not found" });
        }

        // Check if lawyer exists
        const lawyerRef = ref(database, `lawyers/${lawyer_id}`);
        const lawyerSnapshot = await get(lawyerRef);
        if (!lawyerSnapshot.exists()) {
            logger.warn(`Lawyer not found: ${lawyer_id}`);
            return res.status(404).json({ success: false, message: "Lawyer not found" });
        }

        // Both client and lawyer exist, create a new comment
        const newCommentRef = push(ref(database, 'lawyer_comments'));
        const createdAt = new Date().toISOString();
        const newComment = {
            client_id,
            lawyer_id,
            comment_text,
            created_at: createdAt
        };
        lawyer_interactions.addInteraction(client_id, lawyer_id, 'comment');
        await set(newCommentRef, newComment);
        logger.info(`New comment added successfully: ${newCommentRef.key}`);

        res.status(201).json({ success: true, data: { ...newComment, comment_id: newCommentRef.key } });
    } catch (error) {
        logger.error("Error creating lawyer comment:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Retrieve all comments for a specific client
exports.getCommentsByClientId = async (req, res) => {
    try {
        const { client_id } = req.params;

        const clientRef = ref(database, `clients/${client_id}`);
        const clientSnapshot = await get(clientRef);
        if (!clientSnapshot.exists()) {
            logger.warn(`Client not found for comment retrieval: ${client_id}`);
            return res.status(404).json({ success: false, message: "Client not found" });
        }

        const commentsRef = ref(database, 'lawyer_comments');
        const commentsSnapshot = await get(commentsRef);
        const comments = commentsSnapshot.val();
        const clientComments = {};

        if (comments) {
            for (const comment_id in comments) {
                if (comments[comment_id].client_id === client_id) {
                    clientComments[comment_id] = comments[comment_id];
                }
            }
        }

        if (Object.keys(clientComments).length === 0) {
            logger.info(`No comments found for client: ${client_id}`);
            return res.status(404).json({ success: false, message: "No comments found for this client" });
        }

        logger.info(`Comments retrieved for client: ${client_id}`);
        res.status(200).json({ success: true, data: clientComments });
    } catch (error) {
        logger.error("Error retrieving comments by client ID:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};


// Retrieve all comments, their replies, and client data for a specific lawyer
exports.getCommentsAndRepliesByLawyerId = async (req, res) => {
    try {
        const { lawyer_id } = req.params;
        logger.info(`Fetching comments and replies for lawyer ID: ${lawyer_id}`);

        const lawyerCommentsRef = ref(database, 'lawyer_comments');
        const commentsSnapshot = await get(lawyerCommentsRef);
        const allComments = commentsSnapshot.val();
        const lawyerComments = {};

        if (allComments) {
            for (const comment_id in allComments) {
                if (allComments[comment_id].lawyer_id === lawyer_id) {
                    lawyerComments[comment_id] = {
                        ...allComments[comment_id],
                        client_data: {},
                        replies: {}
                    };

                    const clientRef = ref(database, `clients/${allComments[comment_id].client_id}`);
                    const clientSnapshot = await get(clientRef);
                    if (clientSnapshot.exists()) {
                        lawyerComments[comment_id].client_data = clientSnapshot.val();
                    } else {
                        logger.warn(`Client not found for comment ID: ${comment_id}`);
                    }

                    const repliesRef = ref(database, `lawyer_comments_replies/${comment_id}`);
                    const repliesSnapshot = await get(repliesRef);
                    if (repliesSnapshot.exists()) {
                        lawyerComments[comment_id].replies = repliesSnapshot.val();
                    }
                }
            }
        }

        logger.info(`Successfully retrieved comments and replies for lawyer ID: ${lawyer_id}`);
        res.status(200).json({ success: true, data: lawyerComments });
    } catch (error) {
        logger.error("Error retrieving comments and replies by lawyer ID:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};


// Create a reply to a lawyer comment
exports.createLawyerCommentReply = async (req, res) => {
    try {
        const { comment_id, lawyer_id, reply_text } = req.body;
        logger.info(`Creating reply for comment ID: ${comment_id} by lawyer ID: ${lawyer_id}`);

        if (!reply_text) {
            logger.warn('Reply text is required.');
            return res.status(400).json({ success: false, message: "Reply text is required." });
        }

        const commentRef = ref(database, `lawyer_comments/${comment_id}`);
        const commentSnapshot = await get(commentRef);
        if (!commentSnapshot.exists()) {
            logger.warn(`Comment not found: ${comment_id}`);
            return res.status(404).json({ success: false, message: "Comment not found" });
        }

        const lawyerRef = ref(database, `lawyers/${lawyer_id}`);
        const lawyerSnapshot = await get(lawyerRef);
        if (!lawyerSnapshot.exists()) {
            logger.warn(`Lawyer not found: ${lawyer_id}`);
            return res.status(404).json({ success: false, message: "Lawyer not found" });
        }

        const replyRef = push(ref(database, `lawyer_comments_replies/${comment_id}`));
        const repliedAt = new Date().toISOString();
        const newReply = {
            lawyer_id,
            reply_text,
            created_at: repliedAt
        };

        await set(replyRef, newReply);
        logger.info(`Reply created successfully for comment ID: ${comment_id}`);
        res.status(201).json({ success: true, data: newReply });
    } catch (error) {
        logger.error("Error creating reply to lawyer comment:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};


exports.getRepliesByCommentId = async (req, res) => {
    try {
        const { comment_id } = req.params;

        logger.info(`Fetching replies for comment ID: ${comment_id}`);

        const commentRef = ref(database, `lawyer_comments/${comment_id}`);
        const commentSnapshot = await get(commentRef);
        if (!commentSnapshot.exists()) {
            logger.warn(`No comment found for ID: ${comment_id}`);
            return res.status(404).json({ success: false, message: "Comment not found" });
        }

        const repliesRef = ref(database, `lawyer_comments_replies/${comment_id}`);
        const repliesSnapshot = await get(repliesRef);
        const replies = repliesSnapshot.val();
        const commentReplies = {};

        if (replies) {
            for (const reply_id in replies) {
                commentReplies[reply_id] = replies[reply_id];
            }
            logger.info(`Replies retrieved successfully for comment ID: ${comment_id}`);
        } else {
            logger.info(`No replies found for comment ID: ${comment_id}`);
            return res.status(404).json({ success: false, message: "No replies found for this comment" });
        }

        res.status(200).json({ success: true, data: commentReplies });
    } catch (error) {
        logger.error(`Error retrieving replies by comment ID: ${comment_id}`, error);
        res.status(500).json({ success: false, message: error.message });
    }
};


exports.deleteLawyerComment = async (req, res) => {
    const { comment_id } = req.params;

    try {
        logger.info(`Attempting to delete comment and its replies for comment ID: ${comment_id}`);

        const commentRef = ref(database, `lawyer_comments/${comment_id}`);
        const commentSnapshot = await get(commentRef);
        if (!commentSnapshot.exists()) {
            logger.warn(`Comment not found for ID: ${comment_id}`);
            return res.status(404).json({ success: false, message: "Comment not found" });
        }

        await set(commentRef, null); // Delete the comment
        logger.info(`Comment deleted successfully for comment ID: ${comment_id}`);

        const repliesRef = ref(database, `lawyer_comments_replies/${comment_id}`);
        const repliesSnapshot = await get(repliesRef);
        if (repliesSnapshot.exists()) {
            await set(repliesRef, null); // Delete all replies
            logger.info(`All related replies deleted for comment ID: ${comment_id}`);
        }

        res.status(200).json({ success: true, message: "Comment and all related replies have been deleted successfully." });
    } catch (error) {
        logger.error(`Error deleting comment and replies for comment ID: ${comment_id}`, error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteLawyerCommentReply = async (req, res) => {
    const { comment_id, reply_id } = req.params;

    try {
        logger.info(`Attempting to delete reply for comment ID: ${comment_id}, reply ID: ${reply_id}`);

        // Check if the reply exists
        const replyRef = ref(database, `lawyer_comments_replies/${comment_id}/${reply_id}`);
        const replySnapshot = await get(replyRef);
        if (!replySnapshot.exists()) {
            logger.warn(`Reply not found for ID: ${reply_id} under comment ID: ${comment_id}`);
            return res.status(404).json({ success: false, message: "Reply not found" });
        }

        await set(replyRef, null); // Delete the reply
        logger.info(`Reply deleted successfully for reply ID: ${reply_id} under comment ID: ${comment_id}`);

        res.status(200).json({ success: true, message: "Reply has been deleted successfully." });
    } catch (error) {
        logger.error(`Error deleting reply for reply ID: ${reply_id} under comment ID: ${comment_id}`, error);
        res.status(500).json({ success: false, message: error.message });
    }
};
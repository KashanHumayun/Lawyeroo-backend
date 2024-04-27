const { ref, push, set, get, child } = require('firebase/database');
const { database } = require('../config/firebaseConfig');

// Create a lawyer comment
exports.createLawyerComment = async (req, res) => {
    try {
        const { client_id, lawyer_id, comment_text } = req.body;

        if (!comment_text) {
            return res.status(400).json({ success: false, message: "Comment text is required." });
        }

        // Check if client exists
        const clientRef = ref(database, `clients/${client_id}`);
        const clientSnapshot = await get(clientRef);
        if (!clientSnapshot.exists()) {
            return res.status(404).json({ success: false, message: "Client not found" });
        }

        // Check if lawyer exists
        const lawyerRef = ref(database, `lawyers/${lawyer_id}`);
        const lawyerSnapshot = await get(lawyerRef);
        if (!lawyerSnapshot.exists()) {
            return res.status(404).json({ success: false, message: "Lawyer not found" });
        }

        // Both client and lawyer exist, create a new comment reference in the 'lawyer_comments' node
        const newCommentRef = push(ref(database, 'lawyer_comments'));
        const createdAt = new Date().toISOString();
        const newComment = {
            client_id,
            lawyer_id,
            comment_text,
            created_at: createdAt
        };

        // Save the new comment in the database
        await set(newCommentRef, newComment);

        // Include the comment ID in the response
        const commentId = newCommentRef.key; // Get the unique key for the new comment
        const fullCommentData = { ...newComment, comment_id: commentId };

        res.status(201).json({ success: true, data: fullCommentData });
    } catch (error) {
        console.error("Error creating lawyer comment:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};


// Retrieve all comments for a specific client
exports.getCommentsByClientId = async (req, res) => {
    try {
        const { client_id } = req.params; // Assuming client_id is passed as a route parameter

        // Check if client exists
        const clientRef = ref(database, `clients/${client_id}`);
        const clientSnapshot = await get(clientRef);
        if (!clientSnapshot.exists()) {
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
            return res.status(404).json({ success: false, message: "No comments found for this client" });
        }

        res.status(200).json({ success: true, data: clientComments });
    } catch (error) {
        console.error("Error retrieving comments by client ID:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Retrieve all comments, their replies, and client data for a specific lawyer
exports.getCommentsAndRepliesByLawyerId = async (req, res) => {
    try {
        const { lawyer_id } = req.params; // Assuming lawyer_id is passed as a route parameter
        const lawyerCommentsRef = ref(database, 'lawyer_comments');
        const commentsSnapshot = await get(lawyerCommentsRef);
        const allComments = commentsSnapshot.val();
        const lawyerComments = {};

        if (allComments) {
            for (const comment_id in allComments) {
                if (allComments[comment_id].lawyer_id === lawyer_id) {
                    // Initialize the comment structure with client data placeholder
                    lawyerComments[comment_id] = {
                        ...allComments[comment_id],
                        client_data: {},
                        replies: {}
                    };

                    // Fetch client data
                    const clientRef = ref(database, `clients/${allComments[comment_id].client_id}`);
                    const clientSnapshot = await get(clientRef);
                    if (clientSnapshot.exists()) {
                        lawyerComments[comment_id].client_data = clientSnapshot.val();
                    }

                    // Fetch replies for the comment
                    const repliesRef = ref(database, `lawyer_comments_replies/${comment_id}`);
                    const repliesSnapshot = await get(repliesRef);
                    if (repliesSnapshot.exists()) {
                        lawyerComments[comment_id].replies = repliesSnapshot.val();
                    }
                }
            }
        }

        res.status(200).json({ success: true, data: lawyerComments });
    } catch (error) {
        console.error("Error retrieving comments and replies by lawyer ID:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};


// Create a reply to a lawyer comment
exports.createLawyerCommentReply = async (req, res) => {
    try {
        const { comment_id, lawyer_id, reply_text } = req.body;

        if (!reply_text) {
            return res.status(400).json({ success: false, message: "Reply text is required." });
        }

        // Check if the comment exists
        const commentRef = ref(database, `lawyer_comments/${comment_id}`);
        const commentSnapshot = await get(commentRef);
        if (!commentSnapshot.exists()) {
            return res.status(404).json({ success: false, message: "Comment not found" });
        }

        // Check if the lawyer exists
        const lawyerRef = ref(database, `lawyers/${lawyer_id}`);
        const lawyerSnapshot = await get(lawyerRef);
        if (!lawyerSnapshot.exists()) {
            return res.status(404).json({ success: false, message: "Lawyer not found" });
        }

        // Both comment and lawyer exist, create a new reply reference
        const replyRef = push(ref(database, `lawyer_comments_replies/${comment_id}`));
        const repliedAt = new Date().toISOString();
        const newReply = {
            lawyer_id,
            reply_text,
            created_at: repliedAt
        };

        await set(replyRef, newReply);
        res.status(201).json({ success: true, data: newReply });
    } catch (error) {
        console.error("Error creating reply to lawyer comment:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};


exports.getRepliesByCommentId = async (req, res) => {
    try {
        const { comment_id } = req.params; // Assuming comment_id is passed as a route parameter

        // First, check if the comment exists
        const commentRef = ref(database, `lawyer_comments/${comment_id}`);
        const commentSnapshot = await get(commentRef);
        if (!commentSnapshot.exists()) {
            return res.status(404).json({ success: false, message: "Comment not found" });
        }

        // If the comment exists, fetch the replies
        const repliesRef = ref(database, `lawyer_comments_replies/${comment_id}`);
        const repliesSnapshot = await get(repliesRef);
        const replies = repliesSnapshot.val();
        const commentReplies = {};

        if (replies) {
            for (const reply_id in replies) {
                commentReplies[reply_id] = replies[reply_id];
            }
        } else {
            // If there are no replies, inform the user
            return res.status(404).json({ success: false, message: "No replies found for this comment" });
        }

        res.status(200).json({ success: true, data: commentReplies });
    } catch (error) {
        console.error("Error retrieving replies by comment ID:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};


// Delete a lawyer comment and all related replies
exports.deleteLawyerComment = async (req, res) => {
    const { comment_id } = req.params; // Assuming comment_id is passed as a URL parameter

    try {
        const commentRef = ref(database, `lawyer_comments/${comment_id}`);
        const commentSnapshot = await get(commentRef);
        if (!commentSnapshot.exists()) {
            return res.status(404).json({ success: false, message: "Comment not found" });
        }

        await set(commentRef, null); // Delete the comment

        const repliesRef = ref(database, `lawyer_comments_replies/${comment_id}`);
        const repliesSnapshot = await get(repliesRef);
        if (repliesSnapshot.exists()) {
            await set(repliesRef, null); // Delete all replies
        }

        res.status(200).json({ success: true, message: "Comment and all related replies have been deleted successfully." });
    } catch (error) {
        console.error("Error deleting comment and replies:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

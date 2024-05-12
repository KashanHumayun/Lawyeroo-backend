const express = require('express');
const router = express.Router();
const { getDatabase, ref, set, push, update } = require("firebase/database");
const { storage, database, getLawyerByEmail, getClientByEmail } = require('../config/firebaseConfig');

// Function to generate a symmetric conversation ID
function generateConversationId(senderId, receiverId) {
    return [senderId, receiverId].sort().join('_');
}

// Using the function in your route
router.post('/send', async (req, res) => {
    const { senderId, receiverId, messageText } = req.body;
    const db = getDatabase();
    const conversationId = generateConversationId(senderId, receiverId);  // Symmetric ID generation

    try {
        // Create new message
        const messageRef = push(ref(db, `messages/${conversationId}`));
        await set(messageRef, {
            senderId,
            receiverId,
            messageText,
            timestamp: Date.now()
        });

        // Update conversation list for both sender and receiver
        const updates = {};
        updates[`/clients/${senderId}/conversations/${conversationId}`] = true;
        updates[`/lawyers/${receiverId}/conversations/${conversationId}`] = true;
        await update(ref(db), updates);

        res.status(201).json({ message: 'Message sent successfully.' });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: error.message });
    }
});


router.get('/:conversationId', async (req, res) => {
    const { conversationId } = req.params;
    const db = getDatabase();
    const messagesRef = ref(db, `messages/${conversationId}`);

    try {
        // Query the database to retrieve messages ordered by timestamp
        const queryRef = query(messagesRef, orderByChild('timestamp'));
        const snapshot = await get(queryRef);

        if (snapshot.exists()) {
            const messages = snapshot.val();
            // Convert messages from object to array if needed, and sort them (Firebase should return them sorted, this is just in case)
            const sortedMessages = Object.keys(messages)
                .map(key => ({ id: key, ...messages[key] }))
                .sort((a, b) => a.timestamp - b.timestamp);

            res.status(200).json(sortedMessages);
        } else {
            res.status(404).json({ message: 'No messages found.' });
        }
    } catch (error) {
        console.error('Error retrieving messages:', error);
        res.status(500).json({ error: error.message });
    }
});

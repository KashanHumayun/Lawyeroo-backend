const { getDatabase, ref, set, get, push, update, query, orderByChild } = require("firebase/database");

// Function to generate a symmetric conversation ID
function generateConversationId(senderId, receiverId) {
    return [senderId, receiverId].sort().join('_');
}

// Send a message
exports.sendMessage = async (req, res) => {
    const { senderId, receiverId, messageText } = req.body;
    const db = getDatabase();
    const conversationId = generateConversationId(senderId, receiverId);

    try {
        const messageRef = push(ref(db, `messages/${conversationId}`));
        await set(messageRef, {
            senderId,
            receiverId,
            messageText,
            timestamp: Date.now()
        });

        const updates = {};
        updates[`/clients/${senderId}/conversations/${conversationId}`] = true;
        updates[`/lawyers/${receiverId}/conversations/${conversationId}`] = true;
        await update(ref(db), updates);

        res.status(201).json({ message: 'Message sent successfully.' });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get all messages in a conversation
exports.getMessages = async (req, res) => {
    const { conversationId } = req.params;
    const db = getDatabase();
    const messagesRef = ref(db, `messages/${conversationId}`);

    try {
        const queryRef = query(messagesRef, orderByChild('timestamp'));
        const snapshot = await get(queryRef);

        if (snapshot.exists()) {
            const messages = snapshot.val();
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
};

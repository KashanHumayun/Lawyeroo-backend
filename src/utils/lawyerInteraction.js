const { ref, push, set } = require('firebase/database');
const { database } = require('../config/firebaseConfig');

// Utility function to add an interaction
function addInteraction(lawyer_id, client_id, interaction_type) {
    return new Promise(async (resolve, reject) => {
        if (!lawyer_id || !client_id || !interaction_type) {
            reject(new Error('Missing required fields'));
            return;
        }

        try {
            const interactionsRef = ref(database, 'lawyer_interactions');
            const newInteractionRef = push(interactionsRef);
            const timestamp = new Date().toISOString();

            const interactionData = {
                lawyer_id,
                client_id,
                interaction_type,
                timestamp
            };

            await set(newInteractionRef, interactionData);
            resolve({
                message: 'Interaction added successfully',
                interactionId: newInteractionRef.key
            });
        } catch (error) {
            console.error('Error adding interaction:', error);
            reject(error);
        }
    });
}

module.exports = {
    addInteraction
};

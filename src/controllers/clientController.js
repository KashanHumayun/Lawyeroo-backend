// controllers/clientController.js
const Client = require('../models/clientModel');
const { ref, set, push, getDatabase, get} = require('firebase/database');
const database = getDatabase();

const addClient = async (req, res) => {
    try {
      const { 
        first_name = '', 
        last_name = '', 
        email = '', 
        ph_number = '', 
        address = '', 
        profile_picture = '', 
        verified = false, 
        account_type = 'Client', 
        preferences = '', 
        password = '' 
      } = req.body;
  
      // Set default values for empty fields
      const clientProfilePicture = profile_picture.trim() || "default.jpg";
      const clientPassword = password || "password@123";
      const clientVerified = verified || false;
      const clientAccountType = account_type || "Client";
      const clientPreferences = preferences || "";

      const newClient = new Client(
        first_name, 
        last_name, 
        email, 
        ph_number, 
        address, 
        clientPassword, 
        new Date().toISOString(), 
        new Date().toISOString(), 
        clientProfilePicture, 
        clientVerified, 
        clientAccountType, 
        clientPreferences
      );
  
      const clientRef = push(ref(database, 'clients'));
      await set(clientRef, newClient.serialize());
  
      res.status(201).json({ message: 'Client added successfully', clientId: clientRef.key });
    } catch (error) {
      res.status(500).json({ message: 'Error adding client', error: error.message });
    }
};


const getAllClients = async (req, res) => {
  try {
    const snapshot = await get(ref(database, 'clients'));
    if (!snapshot.exists()) {
      return res.status(404).json({ message: 'No clients found' });
    }

    const clients = snapshot.val();
    const clientArray = Object.keys(clients).map(key => ({ client_id: key, ...clients[key] }));
    res.status(200).json(clientArray);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving clients', error: error.message });
  }
};

module.exports = { addClient, getAllClients };

const Client = require('../models/clientModel');
const { ref, set, push, getDatabase ,get } = require('firebase/database');
const { ref: storageRef, uploadBytes, getDownloadURL } = require('firebase/storage');
const { storage } = require('../utils/firebaseConfig');
const axios = require('axios');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const database = getDatabase();

async function uploadImageToFirebaseStorage(fileBuffer, fileName) {
    const fileRef = storageRef(storage, 'images/' + fileName);
    const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${fileRef.bucket}/o?uploadType=media&name=${encodeURIComponent(fileRef.fullPath)}`;

    console.log("Attempting to upload file:", fileName);

    try {
        const response = await axios.post(uploadUrl, fileBuffer, {
            headers: { 'Content-Type': 'application/octet-stream' }
        });
        console.log("File uploaded, metadata:", response.data);

        const url = `https://firebasestorage.googleapis.com/v0/b/${fileRef.bucket}/o/${encodeURIComponent(fileRef.fullPath)}?alt=media`;
        console.log("Download URL obtained:", url);
        return url;
    } catch (error) {
        console.error('Upload failed:', error.response || error.message);
        throw new Error('Failed to upload image due to error: ' + error.message);
    }
}

const addClient = async (req, res) => {
    try {
        const {
            first_name = '',
            last_name = '',
            email = '',
            ph_number = '',
            address = '',
            password = '',
            verified = false,
            account_type = 'Client',
            preferences = '[]'
        } = req.body;

        console.log("Parsed data from request:", req.body);
        const clientPreferences = JSON.parse(preferences);
        console.log("Preferences parsed:", clientPreferences);

        let profile_picture = "default.jpg";  // Assume a default if no file
        console.log("Default profile picture URL set");

        if (req.file) {
            console.log("Received file with name:", req.file.originalname);
            profile_picture = await uploadImageToFirebaseStorage(req.file.buffer, req.file.originalname);
            console.log("Image successfully uploaded to Firebase Storage, URL:", profile_picture);
        } else {
            console.log("No file received, using default profile picture.");
        }

        console.log("Profile picture URL being saved:", profile_picture);

        const passwordHash = await bcrypt.hash(password, saltRounds);
        console.log("Password hashed successfully");

        const newClient = new Client({
            first_name,
            last_name,
            email,
            ph_number,
            address,
            passwordHash,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            profile_picture,
            verified,
            account_type,
            preferences: clientPreferences
        });

        console.log("New client object:", newClient);

        const clientRef = push(ref(database, 'clients'));
        await set(clientRef, newClient.serialize());
        console.log("Client added successfully, ID:", clientRef.key);

        res.status(201).json({ message: 'Client added successfully', clientId: clientRef.key });
    } catch (error) {
        console.error("Error in adding client:", error);
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

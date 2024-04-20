const Client = require('../models/clientModel');
const { ref, set, push, getDatabase ,get } = require('firebase/database');
const { ref: storageRef, uploadBytes, getDownloadURL } = require('firebase/storage');
const { storage } = require('../config/firebaseConfig');
const sendEmail = require('../utils/emailSender');

const axios = require('axios');
const crypto = require('crypto');

const bcrypt = require('bcrypt');
const saltRounds = 10;
const database = getDatabase();
const tempClientsStorage = {};

// Utility function to generate a unique key for each registration
function generateTempKey(email) {
    return `${email}_${Date.now()}`;
}

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

async function initiateClientRegistration(req, res) {
    console.log("Received request to initiate Client registration");

    let { email, password, ...otherDetails } = req.body;
    
    // Validate email format
    if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
        console.log("Invalid email format provided:", email);
        return res.status(400).json({ message: "Invalid email format." });
    }

    // Generate OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    console.log("Generated OTP:", otp);

    // Attempt to send OTP email
    try {
        const message = {
            to: email,
            subject: 'Verify Your Email',
            text: `Your OTP is ${otp}. Please enter this OTP to verify your email address.`,
            html: `<strong>Your OTP is ${otp}</strong>. Please enter this OTP to verify your email address.`
        };
        await sendEmail(message);
        console.log("OTP email sent to:", email);
    } catch (error) {
        console.error("Failed to send OTP email:", error);
        return res.status(500).json({ message: 'Failed to send OTP', error: error.message });
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(password, saltRounds);
    console.log("Password hashed");

    // Store registration data temporarily in memory
    const tempKey = generateTempKey(email);
    tempClientsStorage[tempKey] = {
        email,
        passwordHash,
        otp,
        otpExpires: Date.now() + 300000, // 5 minutes from now
        ...otherDetails
    };
    console.log("Temporary Client data stored in memory", tempKey);
    res.status(200).json({ message: 'OTP sent to your email. Please verify to complete the registration.', tempKey });
}

async function registerClient(req, res) {
    const { tempKey, otp } = req.body;
    console.log('Received registration request:', { tempKey, otp });
    if(req.file){
        console.log('Received picture: nnn');
    }
    else{
        console.log("Picture not receive");
    }
    if (req.file) {
        console.log('Received picture:', req.file.originalname);
    } else {
        console.log("No picture received.");
    }
    
    const entry = tempLawyersStorage[tempKey];
    console.log(entry);
    
    if (!entry) {
        console.log('No registration found for the provided key.');
        return res.status(404).json({ message: 'Registration not found.' });
    }

    if (entry.otp !== otp) {
        console.log('OTP mismatch.');
        return res.status(400).json({ message: 'Invalid or expired OTP.' });
    }

    let currentTime = Date.now();
    if (entry.otpExpires < currentTime) {
        console.log('OTP expired.');
        return res.status(400).json({ message: 'OTP expired.' });
    }

    console.log(`Valid and active entry found: ${tempKey}, registering lawyer...`);

    let imageUrl = "default.jpg";  // Default image URL if none provided
    if (req.file) {
        console.log('Uploading profile picture...');
        try {
            imageUrl = await uploadImageToFirebaseStorage(req.file.buffer, req.file.originalname);
            console.log('Image uploaded successfully:', imageUrl);
        } catch (error) {
            console.error('Image upload failed:', error);
            return res.status(500).json({ message: 'Failed to upload image', error: error.message });
        }
    }

    const clientData = {
        ...entry, profile_picture: imageUrl
    };

    const clientRef = push(ref(database, 'clients'));
    await set(clientRef, clientData);
    console.log('Lawyer data set in database:', clientRef.key);

    // Clear the temporary data from memory
    delete tempClientsStorage[tempKey];
    console.log('Temporary data cleared from memory for:', tempKey);

    res.status(201).json({ message: 'Lawyer registered successfully.', lawyerId: clientRef.key });
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
module.exports = { addClient, getAllClients ,initiateClientRegistration, registerClient };
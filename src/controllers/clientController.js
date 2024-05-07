const Client = require('../models/clientModel');
const { ref, set, push, getDatabase ,update, get, remove } = require('firebase/database');
const { ref: storageRef, uploadBytes, getDownloadURL } = require('firebase/storage');
const { storage, database, getClientByEmail, getLawyerByEmail } = require('../config/firebaseConfig');
const sendEmail = require('../utils/emailSender');
const logger = require('../utils/logger');
const lawyer_interactions = require('../utils/lawyerInteraction');

const axios = require('axios');
const crypto = require('crypto');

const bcrypt = require('bcrypt');
const saltRounds = 10;

const tempClientsStorage = {};

// Utility function to generate a unique key for each registration
function generateTempKey(email) {
    return `${email}_${Date.now()}`;
}

async function uploadImageToFirebaseStorage(fileBuffer, fileName) {
    const fileRef = storageRef(storage, 'images/' + fileName);
    const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${fileRef.bucket}/o?uploadType=media&name=${encodeURIComponent(fileRef.fullPath)}`;

    // logger.info("Attempting to upload file:", fileName);

    try {
        const response = await axios.post(uploadUrl, fileBuffer, {
            headers: { 'Content-Type': 'application/octet-stream' }
        });
        // logger.info("File uploaded, metadata:", response.data);

        const url = `https://firebasestorage.googleapis.com/v0/b/${fileRef.bucket}/o/${encodeURIComponent(fileRef.fullPath)}?alt=media`;
        // logger.info("Download URL obtained:", url);
        return url;
    } catch (error) {
        logger.error('Upload failed:', error.response || error.message);
        throw new Error('Failed to upload image due to error: ' + error.message);
    }
}

async function initiateClientRegistration(req, res) {
    // logger.info("Received request to initiate Client registration");

    let { email, password, preferences, ...otherDetails } = req.body;
    
    const clientPreferences = JSON.parse(preferences);
    // Validate email format
    if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
        // logger.error("Invalid email format provided:", email);
        return res.status(400).json({ message: "Invalid email format." });
    }

    // Check if the email is already used by a lawyer or client
    try {
        const isLawyer = await getLawyerByEmail(email);
        const isClient = await getClientByEmail(email);
        if (isLawyer) {
            return res.status(409).json({ message: 'You are already registered as a lawyer.' });
        }
        if (isClient) {
            return res.status(409).json({ message: 'You are already registered as a client.' });
        }
    } catch (error) {
        // logger.error("Failed to check if email is already registered:", error);
        return res.status(500).json({ message: 'Failed to check registration status', error: error.message });
    }

    // Generate OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    // logger.info("Generated OTP:", otp);
    console.log('Generated OTP', otp);
    // Attempt to send OTP email
    try {
        const message = {
            to: email,
            subject: 'Verify Your Email',
            text: `Your OTP is ${otp}. Please enter this OTP to verify your email address.`,
            html: `<strong>Your OTP is ${otp}</strong>. Please enter this OTP to verify your email address.`
        };
        await sendEmail(message);
        // logger.info("OTP email sent to:", email);
    } catch (error) {
        // logger.error("Failed to send OTP email:", error);
        return res.status(500).json({ message: 'Failed to send OTP', error: error.message });
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(password, saltRounds);
    // logger.info("Password hashed");

    // Store registration data temporarily in memory
    const tempKey = generateTempKey(email);
    tempClientsStorage[tempKey] = {
        email,
        passwordHash,
        otp,
        preferences: clientPreferences,
        otpExpires: Date.now() + 300000, // 5 minutes from now
        ...otherDetails
    };
    // logger.info("Temporary Client data stored in memory", tempKey);
    console.log("Temporary Client data stored in memory", tempKey);
    console.log('Generated OTP', otp);

    res.status(200).json({ message: 'OTP sent to your email. Please verify to complete the registration.', tempKey });
}


async function registerClient(req, res) {
    const { tempKey, otp } = req.body;
    console.log('Received registration request:', { tempKey, otp });
    
    if (req.file) {
        console.log('Received picture:', req.file.originalname);
    } else {
        console.log("No picture received.");
    }
    
    const entry = tempClientsStorage[tempKey];
    console.log("Temp storage entry:", entry);
    
    if (!entry) {
        // logger.error('No registration found for the provided key.');
        return res.status(404).json({ message: 'Registration not found.' });
    }

    if (entry.otp !== otp) {
        // logger.error('OTP mismatch.');
        return res.status(400).json({ message: 'Invalid or expired OTP.' });
    }

    let currentTime = Date.now();
    if (entry.otpExpires < currentTime) {
        logger.error('OTP expired.');
        return res.status(400).json({ message: 'OTP expired.' });
    }

    // logger.info(`Valid and active entry found: ${tempKey}, registering client...`);

    let imageUrl = "default.jpg";  // Default image URL if none provided
    if (req.file) {
        // logger.info('Uploading profile picture...');
        try {
            imageUrl = await uploadImageToFirebaseStorage(req.file.buffer, req.file.originalname);
            // logger.info('Image uploaded successfully:', imageUrl);
        } catch (error) {
            // logger.error('Image upload failed:', error);
            return res.status(500).json({ message: 'Failed to upload image', error: error.message });
        }
    }

    const clientData = {
        ...entry,
        profile_picture: imageUrl
    };

    const clientRef = push(ref(database, 'clients'));
    await set(clientRef, clientData);
    logger.info('Client data set in database:', clientRef.key);

    // Clear the temporary data from memory
    delete tempClientsStorage[tempKey];
    logger.info('Temporary data cleared from memory for:', tempKey);

    res.status(201).json({ message: 'Client registered successfully.', lawyerId: clientRef.key });
}


const addClient = async (req, res) => {
    try {
        const {
            first_name = '',
            last_name = '',
            email = '',
            ph_number = '',
            address = '',
            password = 'password@123',
            verified = false,
            account_type = 'Client',
            preferences = '[]',
            google_profile = '',
        } = req.body;

        logger.info("Parsed data from request:", req.body);
        const clientPreferences = JSON.parse(preferences);
        logger.info("Preferences parsed:", clientPreferences);

        let profile_picture = "default.jpg";  // Assume a default if no file
        if (google_profile) {
            profile_picture = google_profile;
        }
        logger.info("Default profile picture URL set");

        if (req.file) {
            logger.info("Received file with name:", req.file.originalname);
            profile_picture = await uploadImageToFirebaseStorage(req.file.buffer, req.file.originalname);
            logger.info("Image successfully uploaded to Firebase Storage, URL:", profile_picture);
        } else {
            logger.info("No file received, using default profile picture.");
        }

        logger.info("Profile picture URL being saved:", profile_picture);

        const passwordHash = await bcrypt.hash(password, saltRounds);
        logger.info("Password hashed successfully");

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

        logger.info("New client object:", newClient);

        const clientRef = push(ref(database, 'clients'));
        await set(clientRef, newClient.serialize());
        logger.info("Client added successfully, ID:", clientRef.key);

        res.status(201).json({ message: 'Client added successfully', clientId: clientRef.key });
    } catch (error) {
        logger.error("Error in adding client:", error);
        res.status(500).json({ message: 'Error adding client', error: error.message });
    }
};



async function getAllClients(req, res) {
    const {
        name,           // Filter by partial match to first_name or last_name
        verified,       // Filter by verification status ('true' or 'false')
        account_type    // Filter by account type
    } = req.query;

    try {
        const clientRef = ref(database, 'clients');
        const snapshot = await get(clientRef);
        if (!snapshot.exists()) {
            logger.info('No clients found');
            return res.status(404).json({ message: 'No clients found' });
        }

        let clients = [];
        snapshot.forEach(childSnapshot => {
            let client = childSnapshot.val();
            client.client_id = childSnapshot.key; // Assign the Firebase key as the client_id

            // Apply filters
            if (name && !`${client.first_name} ${client.last_name}`.toLowerCase().includes(name.toLowerCase())) {
                return; // Skip this client if name filter is applied and doesn't match
            }
            if (verified && client.verified.toString() !== verified) {
                return; // Skip if verified filter does not match
            }
            if (account_type && client.account_type.toLowerCase() !== account_type.toLowerCase()) {
                return; // Skip if account type filter does not match
            }

            clients.push(client);
        });

        if (clients.length === 0) {
            logger.info('No matching clients found');
            return res.status(404).json({ message: 'No matching clients found' });
        }

        logger.info('Clients retrieved successfully:', clients);
        res.status(200).json(clients);
    } catch (error) {
        logger.error("Error retrieving clients with filters:", error);
        res.status(500).json({ message: 'Error retrieving clients', error: error.message });
    }
}

async function updateClient(req, res) {
    const clientId = req.params.id;
    let updates = req.body;

    // Convert updates to a plain object to ensure compatibility
    updates = JSON.parse(JSON.stringify(updates));

    // Validate inputs
    if (updates.email && !/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(updates.email)) {
        return res.status(400).json({ message: "Invalid email format provided." });
    }
    if (updates.ph_number && !/^\+?\d{10,15}$/.test(updates.ph_number)) {
        return res.status(400).json({ message: "Invalid phone number format." });
    }

    const clientRef = ref(database, `clients/${clientId}`);

    // Check if the lawyer exists before updating
    const existingSnapshot = await get(clientRef);
    if (!existingSnapshot.exists()) {
        logger.error('No such client found');
        return res.status(404).json({ message: 'No such client found' });
    }

    // Handle file upload
    if (req.file) {
        logger.info('Received picture:', req.file.originalname);
        try {
            const imageUrl = await uploadImageToFirebaseStorage(req.file.buffer, req.file.originalname);
            updates.profile_picture = imageUrl; // Ensure this is added to a plain object
            logger.info('Image uploaded successfully:', imageUrl);
        } catch (error) {
            logger.error('Image upload failed:', error);
            return res.status(500).json({ message: 'Failed to upload image', error: error.message });
        }
    }

    logger.info("Updates to be applied:", updates);
    await update(clientRef, updates);
    logger.info('Client updated successfully:', updates);

    // Fetch updated data to return in response
    const updatedSnapshot = await get(clientRef);
    if (updatedSnapshot.exists()) {
        logger.info('Client updated successfully:', updatedSnapshot.val());
        return res.status(200).json({ message: 'Client updated successfully', data: updatedSnapshot.val() });
    } else {
        logger.error('Failed to update client');
        return res.status(404).json({ message: 'Failed to update client' });
    }
}


async function getClientById(req, res) {
    const clientId = req.params.id;  // The ID of the client is expected to be part of the URL path

    const clientRef = ref(database, `clients/${clientId}`);

    try {
        const clientSnapshot = await get(clientRef);
        if (clientSnapshot.exists()) {
            const clientData = clientSnapshot.val();
            logger.info(`Client data retrieved successfully for ID: ${clientId}`);
            res.status(200).json(clientData);
        } else {
            logger.info(`No client found with ID: ${clientId}`);
            res.status(404).json({ message: 'Client not found' });
        }
    } catch (error) {
        logger.error(`Error retrieving client by ID ${clientId}:`, error);
        res.status(500).json({ message: 'Failed to retrieve client', error: error.toString() });
    }
}

async function addFavoriteLawyer(req, res) {
    const { client_id, lawyer_id } = req.body;

    const favoriteRef = ref(database, `clients/${client_id}/favorites/${lawyer_id}`);
    const added_at = new Date().toISOString();

    try {
        await set(favoriteRef, {
            lawyer_id,
            added_at
        });
        lawyer_interactions.addInteraction(lawyer_id, client_id, "favorite");
        logger.info('Lawyer added to favorites successfully');
        res.status(201).json({ message: 'Lawyer added to favorites successfully' });
    } catch (error) {
        logger.error('Failed to add favorite lawyer:', error);
        res.status(500).json({ message: 'Failed to add favorite lawyer', error: error.toString() });
    }
}


async function deleteFavoriteLawyer(req, res) {
    const { client_id, lawyer_id } = req.params;

    const favoriteRef = ref(database, `clients/${client_id}/favorites/${lawyer_id}`);

    try {
        await remove(favoriteRef);
        logger.info('Lawyer removed from favorites successfully');
        res.status(200).json({ message: 'Lawyer removed from favorites successfully' });
    } catch (error) {
        logger.error('Failed to remove favorite lawyer:', error);
        res.status(500).json({ message: 'Failed to remove favorite lawyer', error: error.toString() });
    }
}


async function getAllFavoriteLawyers(req, res) {
    const { client_id } = req.params;

    const favoritesRef = ref(database, `clients/${client_id}/favorites`);

    try {
        const snapshot = await get(favoritesRef);
        if (snapshot.exists()) {
            let favoriteIds = [];
            snapshot.forEach(childSnapshot => {
                favoriteIds.push(childSnapshot.key);  // Assuming the key is the lawyer_id
            });

            // Fetch each lawyer's details using the IDs collected
            const lawyerDetailsPromises = favoriteIds.map(lawyerId => 
                get(ref(database, `lawyers/${lawyerId}`)).then(lawyerSnapshot => {
                    if (lawyerSnapshot.exists()) {
                        return { lawyer_id: lawyerId, ...lawyerSnapshot.val() };
                    } else {
                        return { lawyer_id: lawyerId, message: 'Lawyer details not found' };
                    }
                })
            );

            // Wait for all promises to resolve
            const lawyers = await Promise.all(lawyerDetailsPromises);
            logger.info('Favorite lawyers retrieved successfully:', lawyers);
            res.status(200).json(lawyers);
        } else {
            logger.info('No favorite lawyers found');
            res.status(404).json({ message: 'No favorite lawyers found' });
        }
    } catch (error) {
        logger.error('Failed to retrieve favorite lawyers:', error);
        res.status(500).json({ message: 'Failed to retrieve favorite lawyers', error: error.toString() });
    }
}


module.exports = { addClient, getAllClients ,initiateClientRegistration, registerClient, 
    updateClient, getClientById , addFavoriteLawyer, deleteFavoriteLawyer, getAllFavoriteLawyers};
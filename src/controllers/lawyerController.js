const Lawyer = require('../models/lawyerModel');
const { ref, set, push, getDatabase ,update, get} = require('firebase/database');
const { ref: storageRef, uploadBytes, getDownloadURL } = require('firebase/storage');
const { storage, database, getLawyerByEmail, getClientByEmail } = require('../config/firebaseConfig');
const axios = require('axios');
const crypto = require('crypto');
const sendEmail = require('../utils/emailSender');
const bcrypt = require('bcrypt');
const saltRounds = 10;


// const database = getDatabase();

// Temporary in-memory storage for lawyer registrations
const tempLawyersStorage = {};

// Utility function to generate a unique key for each registration
function generateTempKey(email) {
    return `${email}_${Date.now()}`;
}

async function initiateLawyerRegistration(req, res) {
    console.log("Received request to initiate lawyer registration");

    let { email, password, specializations, ...otherDetails } = req.body;

    // Parse specializations safely
    let parsedSpecializations;
    try {
        parsedSpecializations = JSON.parse(specializations);
        if (!Array.isArray(parsedSpecializations)) {
            throw new Error("Specializations must be an array.");
        }
    } catch (error) {
        console.error("Failed to parse specializations:", error);
        return res.status(400).json({ message: "Invalid specializations format. Must be a valid JSON array." });
    }

    // Validate email format
    if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
        console.log("Invalid email format provided:", email);
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
        console.error("Failed to check if email is already registered:", error);
        return res.status(500).json({ message: 'Failed to check registration status', error: error.message });
    }

    // Continue with OTP generation and registration
    const otp = crypto.randomInt(100000, 999999).toString();
    console.log("Generated OTP:", otp);
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

    const passwordHash = await bcrypt.hash(password, saltRounds);
    console.log("Password hashed");
    const tempKey = generateTempKey(email);
    tempLawyersStorage[tempKey] = {
        email,
        passwordHash,
        otp,
        specializations: parsedSpecializations,
        otpExpires: Date.now() + 300000, // 5 minutes from now
        ...otherDetails
    };

    console.log("Temporary lawyer data stored in memory", tempKey);
    res.status(200).json({ message: 'OTP sent to your email. Please verify to complete the registration.', tempKey });
}



// Environment variable check (usually placed in your initial setup, not within a request handler)
console.log("SendGrid API Key:", process.env.SENDGRID_API_KEY);

//upload image to firebase function
async function uploadImageToFirebaseStorage(fileBuffer, originalFileName) {
    // Extract file extension from original file name
    const extension = originalFileName.split('.').pop();

    // Generate a random hex string for the file name
    const randomName = crypto.randomBytes(16).toString('hex');

    // Construct the new file name with the original extension
    const fileName = `${randomName}.${extension}`;
    const fileRef = storageRef(storage, 'images/' + fileName);

    const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${fileRef.bucket}/o?uploadType=media&name=${encodeURIComponent(fileRef.fullPath)}`;

    console.log("Attempting to upload file:", fileName);
    try {
        const response = await axios.post(uploadUrl, fileBuffer, {
            headers: { 'Content-Type': 'application/octet-stream' }
        });
        const url = `https://firebasestorage.googleapis.com/v0/b/${fileRef.bucket}/o/${encodeURIComponent(fileRef.fullPath)}?alt=media`;
        console.log("Download URL obtained:", url);
        return url;
    } catch (error) {
        console.error('Upload failed:', error.response || error.message);
        throw new Error('Failed to upload image due to error: ' + error.message);
    }
}


async function registerLawyer(req, res) {
    const { tempKey, otp } = req.body;
    console.log('Received registration request:', { tempKey, otp });
    if(req.file){
        console.log('Received picture: nnn');
    }
    else{
        console.log("Picture not reveice");
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

    const lawyerData = {
        ...entry, profile_picture: imageUrl
    };

    const lawyerRef = push(ref(database, 'lawyers'));
    await set(lawyerRef, lawyerData);
    console.log('Lawyer data set in database:', lawyerRef.key);

    // Clear the temporary data from memory
    delete tempLawyersStorage[tempKey];
    console.log('Temporary data cleared from memory for:', tempKey);

    res.status(201).json({ message: 'Lawyer registered successfully.', lawyerId: lawyerRef.key });
}


// function  to add a new Lawyer for testing
async function addLawyer(req, res) {
    console.log("Starting to process adding a new lawyer");
    try {
        let { first_name, last_name, email, fees, ph_number, address, password, years_of_experience, universities, rating, verified, account_type } = req.body;

        // Data sanitization and validation
        first_name = first_name.trim().replace(/[^a-zA-Z -]/g, ''); // Remove non-letter characters
        last_name = last_name.trim().replace(/[^a-zA-Z -]/g, ''); // Remove non-letter characters
        email = email.trim().toLowerCase();
        if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
            throw new Error("Invalid email format.");
        }
        ph_number = ph_number.trim().replace(/[^0-9+]/g, ''); // Allow numbers and plus sign
        if (!/^[\+\d]?[1-9]\d{9,14}$/.test(ph_number)) {
            throw new Error("Invalid phone number format.");
        }
        address = address.trim();
        universities = universities.trim();
        years_of_experience = parseInt(years_of_experience) || 0; // Ensure it's a number
        rating = parseFloat(rating) || 0; // Ensure it's a number
        verified = !!verified; // Ensure it's a boolean
        account_type = account_type || 'Lawyer';
        
        const specializations = JSON.parse(req.body.specializations || '[]').map(s => s.trim()); // Trim and parse specializations safely
        let profile_picture = "default.jpg";
        
        if (req.file) {
            console.log("Received file with name:", req.file.originalname);
            profile_picture = await uploadImageToFirebaseStorage(req.file.buffer, req.file.originalname);
        } else {
            console.log("No file received, using default profile picture.");
        }
        
        const passwordHash = await bcrypt.hash(password, saltRounds);
        const newLawyer = new Lawyer({
            first_name, last_name, email, fees, ph_number, address, passwordHash, specializations, years_of_experience, universities, rating, profile_picture, verified, account_type
        });

        const lawyerRef = push(ref(database, 'lawyers'));
        await set(lawyerRef, newLawyer.serialize());
        console.log("Lawyer added successfully, ID:", lawyerRef.key);
        res.status(201).json({ message: 'Lawyer added successfully', lawyerId: lawyerRef.key });
    } catch (error) {
        console.error("Error in adding lawyer:", error);
        res.status(500).json({ message: 'Error adding lawyer', error: error.message });
    }
}

// function to get all lawyers
async function getAllLawyers(req, res) {
    try {
        const lawyerRef = ref(database, 'lawyers');
        const snapshot = await get(lawyerRef);
        if (!snapshot.exists()) {
            return res.status(404).json({ message: 'No lawyers found' });
        }
        const lawyers = snapshot.val();
        const lawyerArray = Object.keys(lawyers).map(key => ({
            lawyer_id: key,
            ...lawyers[key]
        }));
        res.status(200).json(lawyerArray);
    } catch (error) {
        console.error("Error retrieving lawyers:", error);
        res.status(500).json({ message: 'Error retrieving lawyers', error: error.message });
    }
}


// New controller function to test image uploads
async function uploadTestController(req, res) {
    // Log detailed information about the received request
    console.log('Request Headers:', req.headers);
    console.log('Request Body Keys:', Object.keys(req.body));  // Display keys of any other form fields received

    if (req.file) {
        // Log file details if received
        console.log('Received image file name:', req.file.originalname);
        console.log('File details:', {
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size
        });

        res.send({
            message: `Received image: ${req.file.originalname}`,
            fileInfo: {
                originalName: req.file.originalname,
                mimeType: req.file.mimetype,
                size: req.file.size
            }
        });
    } else {
        // Provide a more detailed error response if no file is received
        console.log('No image uploaded.');
        res.status(400).send({
            message: 'No image uploaded.',
            error: 'The server did not receive a file. Check the file field name and the form encoding type.',
            headers: req.headers,
            bodyKeys: Object.keys(req.body)  // This might help identify misnamed file fields or other data errors
        });
    }
};

async function updateLawyer(req, res) {
    const lawyerId = req.params.id;
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
    if (updates.fees && isNaN(parseFloat(updates.fees))) {
        return res.status(400).json({ message: "Invalid fees format." });
    }

    const lawyerRef = ref(database, `lawyers/${lawyerId}`);

    // Check if the lawyer exists before updating
    const existingSnapshot = await get(lawyerRef);
    if (!existingSnapshot.exists()) {
        return res.status(404).json({ message: 'No such lawyer found' });
    }

    // Handle file upload
    if (req.file) {
        console.log('Received picture:', req.file.originalname);
        const imageUrl = await uploadImageToFirebaseStorage(req.file.buffer, req.file.originalname);
        updates.profile_picture = imageUrl; // Ensure this is added to a plain object
        console.log('Image uploaded successfully:', imageUrl);
    }

    console.log("Updates to be applied:", updates);
    await update(lawyerRef, updates);
    console.log('Lawyer updated successfully:', updates);

    // Fetch updated data to return in response
    const updatedSnapshot = await get(lawyerRef);
    if (updatedSnapshot.exists()) {
        return res.status(200).json({ message: 'Lawyer updated successfully', data: updatedSnapshot.val() });
    } else {
        return res.status(404).json({ message: 'Failed to update lawyer' });
    }
}


module.exports = { addLawyer, getAllLawyers, registerLawyer, initiateLawyerRegistration, uploadTestController, updateLawyer };

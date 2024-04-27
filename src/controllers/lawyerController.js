const Lawyer = require('../models/lawyerModel');
const { ref, set, push, getDatabase ,update, get, remove, query, orderByChild, equalTo} = require('firebase/database');
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

async function getAllLawyers(req, res) {
    const {
        name,           // Filter by name (partial match to first_name or last_name)
        verified,       // Filter by verification status ('true' or 'false')
        minRating,      // Minimum rating
        maxRating,      // Maximum rating
        minExperience,  // Minimum years of experience
        maxExperience,  // Maximum years of experience
        specializations // Filter by specializations (comma-separated values)
    } = req.query;

    try {
        const lawyerRef = ref(database, 'lawyers');
        const snapshot = await get(lawyerRef);
        if (!snapshot.exists()) {
            return res.status(404).json({ message: 'No lawyers found' });
        }

        let lawyers = [];
        snapshot.forEach(childSnapshot => {
            let lawyer = childSnapshot.val();
            lawyer.lawyer_id = childSnapshot.key;

            // Apply filters
            if (name && !`${lawyer.first_name} ${lawyer.last_name}`.toLowerCase().includes(name.toLowerCase())) {
                return; // Skip this lawyer if name filter is applied and doesn't match
            }
            if (verified && lawyer.verified.toString() !== verified) {
                return; // Skip if verified filter does not match
            }
            if ((minRating && parseFloat(lawyer.rating) < parseFloat(minRating)) || (maxRating && parseFloat(lawyer.rating) > parseFloat(maxRating))) {
                return; // Skip if outside of rating bounds
            }
            if ((minExperience && parseInt(lawyer.years_of_experience) < parseInt(minExperience)) || (maxExperience && parseInt(lawyer.years_of_experience) > parseInt(maxExperience))) {
                return; // Skip if outside of experience bounds
            }
            if (specializations) {
                const specArray = specializations.split(',').map(spec => spec.trim().toLowerCase());
                const lawyerSpecs = lawyer.specializations.map(spec => spec.toLowerCase());
                if (!specArray.some(spec => lawyerSpecs.includes(spec))) {
                    return; // Skip if no matching specializations
                }
            }

            lawyers.push(lawyer);
        });

        if (lawyers.length === 0) {
            return res.status(404).json({ message: 'No matching lawyers found' });
        }

        res.status(200).json(lawyers);
    } catch (error) {
        console.error("Error retrieving lawyers with filters:", error);
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

async function getLawyerById(req, res) {
    const { lawyerId } = req.params;  // Lawyer ID from the URL parameter

    const lawyerRef = ref(database, `lawyers/${lawyerId}`);

    try {
        const lawyerSnapshot = await get(lawyerRef);
        if (lawyerSnapshot.exists()) {
            const lawyerData = lawyerSnapshot.val();
            console.log(`Lawyer data retrieved successfully for ID: ${lawyerId}`);
            res.status(200).json(lawyerData);
        } else {
            console.log(`No lawyer found with ID: ${lawyerId}`);
            res.status(404).json({ message: 'Lawyer not found' });
        }
    } catch (error) {
        console.error(`Error retrieving lawyer by ID ${lawyerId}:`, error);
        res.status(500).json({ message: 'Failed to retrieve lawyer', error: error.toString() });
    }
}

/// ratings for lawyers


// Function to add a new rating
async function addRating(req, res) {
    const { lawyer_id, client_id, ratings, comment_text } = req.body;
    const created_at = new Date().toISOString();

    if (!lawyer_id || !client_id || ratings === undefined) {
        return res.status(400).json({ message: 'Missing required fields' });
    }
    if (isNaN(ratings) || ratings < 1 || ratings > 5) {
        return res.status(400).json({ message: 'Invalid ratings. Must be a number between 1 and 5.' });
    }

    const ratingRef = push(ref(database, 'lawyer_ratings'));
    const ratingData = { lawyer_id, client_id, ratings, comment_text, created_at };

    try {
        await set(ratingRef, ratingData);
        console.log('Rating added successfully:', ratingRef.key);
        await updateLawyerRatingOnAdd(lawyer_id, ratings);
        return res.status(201).json({ message: 'Rating added successfully', ratingId: ratingRef.key });
    } catch (error) {
        console.error('Error adding rating:', error);
        return res.status(500).json({ message: 'Error adding rating', error: error.message });
    }
}

// Update the lawyer's average rating after adding a new rating
async function updateLawyerRatingOnAdd(lawyer_id, newRating) {
    const lawyerRef = ref(database, `lawyers/${lawyer_id}`);
    try {
        const lawyerSnapshot = await get(lawyerRef);
        if (!lawyerSnapshot.exists()) {
            throw new Error('Lawyer not found');
        }

        const lawyerData = lawyerSnapshot.val();
        const currentAverageRating = parseFloat(lawyerData.rating) || 0;
        const ratingCount = parseInt(lawyerData.rating_count) || 0;

        const newTotal = currentAverageRating * ratingCount + newRating;
        const newRatingCount = ratingCount + 1;
        const newAverageRating = (newTotal / newRatingCount).toFixed(2);

        await update(lawyerRef, {
            rating: newAverageRating,
            rating_count: newRatingCount
        });
        console.log(`Updated lawyer ${lawyer_id} with new average rating: ${newAverageRating}`);
    } catch (error) {
        console.error('Error updating lawyer rating on add:', error);
        throw new Error('Failed to update lawyer rating due to error: ' + error.message);
    }
}

// Function to update an existing rating
async function updateRating(req, res) {
    const { rating_id } = req.params;
    const { ratings, comment_text } = req.body;

    if (!rating_id) {
        return res.status(400).json({ message: 'Rating ID is required' });
    }
    if (ratings !== undefined && (isNaN(ratings) || ratings < 1 || ratings > 5)) {
        return res.status(400).json({ message: 'Invalid ratings. Must be a number between 1 and 5.' });
    }

    try {
        const ratingRef = ref(database, `lawyer_ratings/${rating_id}`);
        const ratingSnapshot = await get(ratingRef);
        if (!ratingSnapshot.exists()) {
            return res.status(404).json({ message: 'Rating not found' });
        }

        const oldRating = ratingSnapshot.val().ratings;
        const lawyer_id = ratingSnapshot.val().lawyer_id;

        const updates = {};
        if (ratings !== undefined) updates.ratings = ratings;
        if (comment_text !== undefined) updates.comment_text = comment_text;

        await update(ratingRef, updates);
        console.log('Rating updated successfully:', rating_id);

        if (ratings !== undefined && ratings !== oldRating) {
            await updateLawyerRatingOnEdit(lawyer_id, oldRating, ratings);
        }

        return res.status(200).json({ message: 'Rating updated successfully', ratingId: rating_id });
    } catch (error) {
        console.error('Error updating rating:', error);
        return res.status(500).json({ message: 'Error updating rating', error: error.message });
    }
}

// Update the lawyer's average rating after editing an existing rating
async function updateLawyerRatingOnEdit(lawyer_id, oldRating, newRating) {
    const lawyerRef = ref(database, `lawyers/${lawyer_id}`);
    try {
        const lawyerSnapshot = await get(lawyerRef);
        if (!lawyerSnapshot.exists()) {
            throw new Error('Lawyer not found');
        }

        const lawyerData = lawyerSnapshot.val();
        const currentAverageRating = parseFloat(lawyerData.rating) || 0;
        const ratingCount = parseInt(lawyerData.rating_count) || 1;

        const newTotal = (currentAverageRating * ratingCount - oldRating + newRating);
        const newAverageRating = (newTotal / ratingCount).toFixed(2);

        await update(lawyerRef, { rating: newAverageRating });
        console.log(`Updated lawyer ${lawyer_id} with new average rating: ${newAverageRating}`);
    } catch (error) {
        console.error('Error updating lawyer rating on edit:', error);
        throw new Error('Failed to update lawyer rating due to error: ' + error.message);
    }
}

// Function to delete a rating
async function deleteRating(req, res) {
    const { rating_id } = req.params;

    if (!rating_id) {
        return res.status(400).json({ message: 'Rating ID is required' });
    }

    try {
        const ratingRef = ref(database, `lawyer_ratings/${rating_id}`);
        const ratingSnapshot = await get(ratingRef);
        if (!ratingSnapshot.exists()) {
            return res.status(404).json({ message: 'Rating not found' });
        }

        const lawyer_id = ratingSnapshot.val().lawyer_id;
        const oldRating = ratingSnapshot.val().ratings;

        await remove(ratingRef);
        console.log('Rating deleted successfully:', rating_id);
        await updateLawyerRatingOnDelete(lawyer_id, oldRating);

        return res.status(200).json({ message: 'Rating deleted successfully' });
    } catch (error) {
        console.error('Error deleting rating:', error);
        return res.status(500).json({ message: 'Error deleting rating', error: error.message });
    }
}

// Update the lawyer's average rating after deleting a rating
async function updateLawyerRatingOnDelete(lawyer_id, oldRating) {
    const lawyerRef = ref(database, `lawyers/${lawyer_id}`);
    try {
        const lawyerSnapshot = await get(lawyerRef);
        if (!lawyerSnapshot.exists()) {
            throw new Error('Lawyer not found');
        }

        const lawyerData = lawyerSnapshot.val();
        const currentAverageRating = parseFloat(lawyerData.rating) || 0;
        const ratingCount = parseInt(lawyerData.rating_count) || 1;

        if (ratingCount > 1) {
            const newTotal = (currentAverageRating * ratingCount - oldRating);
            const newRatingCount = ratingCount - 1;
            const newAverageRating = (newTotal / newRatingCount).toFixed(2);

            await update(lawyerRef, {
                rating: newAverageRating,
                rating_count: newRatingCount
            });
            console.log(`Updated lawyer ${lawyer_id} with new average rating after deletion: ${newAverageRating}`);
        } else {
            // Reset to default if no ratings left
            await update(lawyerRef, { rating: "0.0", rating_count: 0 });
            console.log(`Updated lawyer ${lawyer_id} with default rating after last rating deletion.`);
        }
    } catch (error) {
        console.error('Error updating lawyer rating on delete:', error);
        throw new Error('Failed to update lawyer rating due to error: ' + error.message);
    }
}

// Function to get all ratings for a specific lawyer with client details without index on lawyer_id
async function getAllRatingsByLawyerWithClients(req, res) {
    const { lawyer_id } = req.params;  // Assume lawyer_id is passed as a URL parameter

    if (!lawyer_id) {
        return res.status(400).json({ message: 'Lawyer ID is required' });
    }

    const ratingsRef = ref(database, 'lawyer_ratings');
    try {
        const allRatingsSnapshot = await get(ratingsRef);
        if (!allRatingsSnapshot.exists()) {
            return res.status(404).json({ message: 'No ratings found' });
        }

        let ratings = [];
        let clientIds = new Set(); // To hold unique client IDs

        // Filter ratings by lawyer_id client-side
        allRatingsSnapshot.forEach((childSnapshot) => {
            let rating = childSnapshot.val();
            if (rating.lawyer_id === lawyer_id) {
                rating.id = childSnapshot.key; // Include the Firebase key as the ID of the rating
                ratings.push(rating);
                clientIds.add(rating.client_id); // Collect unique client IDs
            }
        });

        if (ratings.length === 0) {
            return res.status(404).json({ message: 'No ratings found for this lawyer' });
        }

        // Fetch client details in bulk
        let clients = {};
        for (let clientId of clientIds) {
            const clientRef = ref(database, `clients/${clientId}`);
            const clientSnapshot = await get(clientRef);
            if (clientSnapshot.exists()) {
                clients[clientId] = clientSnapshot.val();
            } else {
                clients[clientId] = { message: 'Client details not found' };
            }
        }

        // Append client details to each rating
        ratings = ratings.map(rating => {
            rating.client = clients[rating.client_id] || { message: 'Client details not found' };
            return rating;
        });

        console.log(`Ratings with client data retrieved successfully for lawyer ID: ${lawyer_id}`);
        return res.status(200).json(ratings);
    } catch (error) {
        console.error('Error retrieving ratings:', error);
        return res.status(500).json({ message: 'Error retrieving ratings', error: error.toString() });
    }
}



module.exports = { addLawyer, getAllLawyers, getLawyerById, registerLawyer, initiateLawyerRegistration, uploadTestController, updateLawyer, addRating, updateRating,getAllRatingsByLawyerWithClients, deleteRating };

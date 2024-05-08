const Lawyer = require('../models/lawyerModel');
const { ref, set, push, getDatabase ,update, get, remove, query, orderByChild, equalTo} = require('firebase/database');
const { ref: storageRef, uploadBytes, getDownloadURL } = require('firebase/storage');
const { storage, database, getLawyerByEmail, getClientByEmail } = require('../config/firebaseConfig');
const axios = require('axios');
const crypto = require('crypto');
const sendEmail = require('../utils/emailSender');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const logger = require('../utils/logger');
const lawyer_interactions = require('../utils/lawyerInteraction');


// const database = getDatabase();

// Temporary in-memory storage for lawyer registrations
const tempLawyersStorage = {};

// Utility function to generate a unique key for each registration
function generateTempKey(email) {
    return `${email}_${Date.now()}`;
}

async function initiateLawyerRegistration(req, res) {
    logger.info("Received request to initiate lawyer registration");

    let { email, password, specializations, ...otherDetails } = req.body;
    let parsedSpecializations = [];

    // Parse specializations safely
    try {
        parsedSpecializations = JSON.parse(specializations);
        if (!Array.isArray(parsedSpecializations)) {
            throw new Error("Specializations must be an array.");
        }
    } catch (error) {
        logger.error("Failed to parse specializations", { error: error.message, specializations });
        return res.status(400).json({ message: "Invalid specializations format. Must be a valid JSON array." });
    }

    // Validate email format
    if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
        logger.warn("Invalid email format provided", { email });
        return res.status(400).json({ message: "Invalid email format." });
    }

    // Check if the email is already used by a lawyer or client
    try {
        const isLawyer = await getLawyerByEmail(email);
        const isClient = await getClientByEmail(email);
        if (isLawyer) {
            logger.warn("Email already registered as lawyer", { email });
            return res.status(409).json({ message: 'You are already registered as a lawyer.' });
        }
        if (isClient) {
            logger.warn("Email already registered as client", { email });
            return res.status(409).json({ message: 'You are already registered as a client.' });
        }
    } catch (error) {
        logger.error("Failed to check if email is already registered", { error: error.message, email });
        return res.status(500).json({ message: 'Failed to check registration status', error: error.message });
    }

    // Continue with OTP generation and registration
    const otp = crypto.randomInt(100000, 999999).toString();
    logger.info("OTP generated", { email, otp });

    try {
        const message = {
            to: email,
            subject: 'Verify Your Email',
            text: `Your OTP is ${otp}. Please enter this OTP to verify your email address.`,
            html: `<strong>Your OTP is ${otp}</strong>. Please enter this OTP to verify your email address.`
        };
        await sendEmail(message);
        logger.info("OTP email sent", { email });
    } catch (error) {
        logger.error("Failed to send OTP email", { email, error: error.message });
        return res.status(500).json({ message: 'Failed to send OTP', error: error.message });
    }

    const passwordHash = await bcrypt.hash(password, saltRounds);
    logger.info("Password hashed", { email });
    const tempKey = generateTempKey(email);
    tempLawyersStorage[tempKey] = {
        email,
        passwordHash,
        otp,
        specializations: parsedSpecializations,
        otpExpires: Date.now() + 300000, // 5 minutes from now
        ...otherDetails
    };

    logger.info("Temporary lawyer data stored in memory", { tempKey });
    res.status(200).json({ message: 'OTP sent to your email. Please verify to complete the registration.', tempKey });
}


// Environment variable check (usually placed in your initial setup, not within a request handler)
console.log("SendGrid API Key:", process.env.SENDGRID_API_KEY);

//upload image to firebase function
async function uploadImageToFirebaseStorage(fileBuffer, originalFileName) {
    const extension = originalFileName.split('.').pop();
    const randomName = crypto.randomBytes(16).toString('hex');
    const fileName = `${randomName}.${extension}`;
    const fileRef = storageRef(storage, 'images/' + fileName);
    const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${fileRef.bucket}/o?uploadType=media&name=${encodeURIComponent(fileRef.fullPath)}`;

    logger.info("Attempting to upload file", { fileName });

    try {
        const response = await axios.post(uploadUrl, fileBuffer, {
            headers: { 'Content-Type': 'application/octet-stream' }
        });
        const url = `https://firebasestorage.googleapis.com/v0/b/${fileRef.bucket}/o/${encodeURIComponent(fileRef.fullPath)}?alt=media`;
        logger.info("File uploaded successfully", { url });
        return url;
    } catch (error) {
        logger.error('Upload failed', { error: error.response || error.message });
        throw new Error('Failed to upload image due to error: ' + error.message);
    }
}



async function registerLawyer(req, res) {
    const { tempKey, otp } = req.body;
    logger.info('Received registration request', { tempKey, otp });

    if (!req.file) {
        logger.warn("No picture received");
    } else {
        logger.info('Received picture for registration', { pictureName: req.file.originalname });
    }
    
    const entry = tempLawyersStorage[tempKey];
    
    if (!entry) {
        logger.warn('No registration found for the provided key', { tempKey });
        return res.status(404).json({ message: 'Registration not found.' });
    }

    if (entry.otp !== otp) {
        logger.warn('OTP mismatch', { providedOtp: otp, expectedOtp: entry.otp });
        return res.status(400).json({ message: 'Invalid or expired OTP.' });
    }

    if (entry.otpExpires < Date.now()) {
        logger.warn('OTP expired', { tempKey, otpExpires: entry.otpExpires });
        return res.status(400).json({ message: 'OTP expired.' });
    }

    let imageUrl = "default.jpg"; // Default image URL if none provided
    if (req.file) {
        try {
            imageUrl = await uploadImageToFirebaseStorage(req.file.buffer, req.file.originalname);
            logger.info('Image uploaded successfully', { imageUrl });
        } catch (error) {
            logger.error('Image upload failed', { error: error.message });
            return res.status(500).json({ message: 'Failed to upload image', error: error.message });
        }
    }

    const lawyerData = {
        ...entry, profile_picture: imageUrl
    };

    const lawyerRef = push(ref(database, 'lawyers'));
    await set(lawyerRef, lawyerData);
    logger.info('Lawyer registered successfully', { lawyerId: lawyerRef.key });

    delete tempLawyersStorage[tempKey];
    logger.info('Temporary data cleared from memory', { tempKey });

    res.status(201).json({ message: 'Lawyer registered successfully.', lawyerId: lawyerRef.key });
}

// function  to add a new Lawyer for testing
async function addLawyer(req, res) {
    logger.info("Starting to process adding a new lawyer", { email: req.body.email });

    try {
        let { first_name, last_name, email, fees, ph_number, address, password, years_of_experience, universities, rating, verified, account_type, specializations } = req.body;

        // Data sanitization and validation
        first_name = first_name.trim().replace(/[^a-zA-Z -]/g, '');
        last_name = last_name.trim().replace(/[^a-zA-Z -]/g, '');
        email = email.trim().toLowerCase();
        
        if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
            logger.error("Invalid email format provided", { email });
            throw new Error("Invalid email format.");
        }

        ph_number = ph_number.trim().replace(/[^0-9+]/g, '');
        if (!/^[\+\d]?[1-9]\d{9,14}$/.test(ph_number)) {
            logger.error("Invalid phone number format", { ph_number });
            throw new Error("Invalid phone number format.");
        }

        address = address.trim();
        universities = universities.trim();
        years_of_experience = parseInt(years_of_experience) || 0;
        rating = parseFloat(rating) || 0;
        verified = !!verified;
        account_type = account_type || 'Lawyer';
        specializations = JSON.parse(req.body.specializations || '[]').map(s => s.trim());

        let profile_picture = "default.jpg";
        if (req.file) {
            logger.info("Received file for profile picture", { file: req.file.originalname });
            profile_picture = await uploadImageToFirebaseStorage(req.file.buffer, req.file.originalname);
        } else {
            logger.info("No file received, using default profile picture");
        }

        const passwordHash = await bcrypt.hash(password, saltRounds);
        const newLawyer = new Lawyer({
            first_name, last_name, email, fees, ph_number, address, passwordHash, specializations, years_of_experience, universities, rating, profile_picture, verified, account_type
        });

        const lawyerRef = push(ref(database, 'lawyers'));
        await set(lawyerRef, newLawyer.serialize());
        logger.info("Lawyer added successfully", { lawyerId: lawyerRef.key });

        res.status(201).json({ message: 'Lawyer added successfully', lawyerId: lawyerRef.key });
    } catch (error) {
        logger.error("Error in adding lawyer", { error: error.message });
        res.status(500).json({ message: 'Error adding lawyer', error: error.message });
    }
}
const predefinedSpecializations = [
    "Personal Injury Lawyer",
    "Estate Planning Lawyer",
    "Bankruptcy Lawyer",
    "Intellectual Property Lawyer",
    "Employment Lawyer",
    "Corporate Lawyer",
    "Immigration Lawyer",
    "Criminal Lawyer",
    "Medical Malpractice Lawyer",
    "Tax Lawyer",
    "Family Lawyer",
    "Worker's Compensation Lawyer",
    "Contract Lawyer",
    "Social Security Disability Lawyer",
    "Civil Litigation Lawyer",
    "General Practice Lawyer"
];

async function getAllLawyers(req, res) {
    const { keyword, yearsOfExperience, rating, specializations, ...otherFilters } = req.query;
    logger.info("Fetching all lawyers with filters", { keyword, yearsOfExperience, rating, specializations, otherFilters });

    try {
        const lawyerRef = ref(database, 'lawyers');
        const snapshot = await get(lawyerRef);

        if (!snapshot.exists()) {
            logger.info("No lawyers found in database");
            return res.status(404).json({ message: 'No lawyers found' });
        }

        let lawyers = Object.values(snapshot.val());

        // Keyword search
        if (keyword) {
            lawyers = lawyers.filter(lawyer => {
                const name = `${lawyer.first_name} ${lawyer.last_name}`.toLowerCase();
                const university = lawyer.universities.toLowerCase();
                const specializationsText = Array.isArray(lawyer.specializations) ?
                    lawyer.specializations.join(', ').toLowerCase() :
                    (lawyer.specializations || '').toLowerCase();
                return name.includes(keyword.toLowerCase()) ||
                    university.includes(keyword.toLowerCase()) ||
                    specializationsText.includes(keyword.toLowerCase());
            });
        }

        // Years of experience filter
        if (yearsOfExperience) {
            lawyers = lawyers.filter(lawyer => lawyer.years_of_experience >= parseInt(yearsOfExperience));
        }

        // Rating filter
        if (rating) {
            lawyers = lawyers.filter(lawyer => lawyer.rating >= parseFloat(rating));
        }

        // Specializations filter
        if (specializations) {
            const specializationArray = specializations.split(',').map(s => s.trim());
            const validSpecializations = specializationArray.filter(s => predefinedSpecializations.includes(s));
            lawyers = lawyers.filter(lawyer => {
                const lawyerSpecializations = Array.isArray(lawyer.specializations) ?
                    lawyer.specializations :
                    [lawyer.specializations];
                return validSpecializations.every(s => lawyerSpecializations.includes(s));
            });
        }

        // Apply other filters
        lawyers = applyLawyerFilters(lawyers, otherFilters);

        if (lawyers.length === 0) {
            logger.info("No matching lawyers found after applying filters");
            return res.status(404).json({ message: 'No matching lawyers found' });
        }

        logger.info("Lawyers retrieved successfully", { count: lawyers.length });
        res.status(200).json(lawyers);
    } catch (error) {
        logger.error("Error retrieving lawyers with filters", { error: error.message });
        res.status(500).json({ message: 'Error retrieving lawyers', error: error.message });
    }
}



function applyLawyerFilters(lawyers, filters) {
    return lawyers.filter(lawyer => {
        for (const key in filters) {
            if (filters[key] && lawyer[key] != filters[key]) {
                return false;
            }
        }
        return true;
    });
}



// New controller function to test image uploads
async function uploadTestController(req, res) {
    logger.debug('Received request to upload image', { headers: req.headers, bodyKeys: Object.keys(req.body) });

    if (req.file) {
        logger.info('Received image file for upload', {
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size
        });

        res.status(200).json({
            message: `Received image: ${req.file.originalname}`,
            fileInfo: {
                originalName: req.file.originalname,
                mimeType: req.file.mimetype,
                size: req.file.size
            }
        });
    } else {
        logger.warn('No image uploaded', { headers: req.headers });
        res.status(400).json({
            message: 'No image uploaded.',
            error: 'The server did not receive a file. Check the file field name and the form encoding type.'
        });
    }
}

async function updateLawyer(req, res) {
    const lawyerId = req.params.id;
    let updates = req.body;

    logger.info('Starting update process for lawyer', { lawyerId, updates });

    if (updates.email && !/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(updates.email)) {
        logger.error('Invalid email format provided', { email: updates.email });
        return res.status(400).json({ message: "Invalid email format provided." });
    }
    if (updates.ph_number && !/^\+?\d{10,15}$/.test(updates.ph_number)) {
        logger.error('Invalid phone number format', { ph_number: updates.ph_number });
        return res.status(400).json({ message: "Invalid phone number format." });
    }
    if (updates.fees && isNaN(parseFloat(updates.fees))) {
        logger.error('Invalid fees format', { fees: updates.fees });
        return res.status(400).json({ message: "Invalid fees format." });
    }

    const lawyerRef = ref(database, `lawyers/${lawyerId}`);
    const existingSnapshot = await get(lawyerRef);

    if (!existingSnapshot.exists()) {
        logger.error('Lawyer not found', { lawyerId });
        return res.status(404).json({ message: 'No such lawyer found' });
    }

    if (req.file) {
        logger.info('Received picture for update', { originalName: req.file.originalname });
        const imageUrl = await uploadImageToFirebaseStorage(req.file.buffer, req.file.originalname);
        updates.profile_picture = imageUrl;
        logger.info('Image uploaded successfully', { imageUrl });
    }

    await update(lawyerRef, updates);
    logger.info('Lawyer updated successfully', { lawyerId });

    const updatedSnapshot = await get(lawyerRef);
    if (updatedSnapshot.exists()) {
        res.status(200).json({ message: 'Lawyer updated successfully', data: updatedSnapshot.val() });
    } else {
        logger.error('Failed to fetch updated lawyer data', { lawyerId });
        res.status(404).json({ message: 'Failed to update lawyer' });
    }
}

async function getLawyerById(req, res) {
    const { lawyerId } = req.params;

    const lawyerRef = ref(database, `lawyers/${lawyerId}`);
    try {
        const lawyerSnapshot = await get(lawyerRef);
        if (lawyerSnapshot.exists()) {
            const lawyerData = lawyerSnapshot.val();
            logger.info(`Lawyer data retrieved successfully for ID: ${lawyerId}`, { lawyerId });
            res.status(200).json(lawyerData);
        } else {
            logger.warn(`No lawyer found with ID: ${lawyerId}`, { lawyerId });
            res.status(404).json({ message: 'Lawyer not found' });
        }
    } catch (error) {
        logger.error(`Error retrieving lawyer by ID ${lawyerId}: ${error}`, { lawyerId, error: error.toString() });
        res.status(500).json({ message: 'Failed to retrieve lawyer', error: error.toString() });
    }
}


/// ratings for lawyers


// Function to add a new rating
async function addRating(req, res) {
    const { lawyer_id, client_id, ratings, comment_text } = req.body;
    const created_at = new Date().toISOString();

    if (!lawyer_id || !client_id || ratings === undefined) {
        logger.error('Missing required fields for adding rating', { lawyer_id, client_id, ratings });
        return res.status(400).json({ message: 'Missing required fields' });
    }
    if (isNaN(ratings) || ratings < 1 || ratings > 5) {
        logger.error('Invalid ratings submitted', { ratings });
        return res.status(400).json({ message: 'Invalid ratings. Must be a number between 1 and 5.' });
    }

    const ratingRef = push(ref(database, 'lawyer_ratings'));
    const ratingData = { lawyer_id, client_id, ratings, comment_text, created_at };

    try {
        await set(ratingRef, ratingData);
        lawyer_interactions.addInteraction(client_id, lawyer_id, 'rating');
        logger.info('Rating added successfully', { ratingId: ratingRef.key, lawyer_id, client_id });
        await updateLawyerRatingOnAdd(lawyer_id, ratings);
        res.status(201).json({ message: 'Rating added successfully', ratingId: ratingRef.key });
    } catch (error) {
        logger.error('Error adding rating', { error: error.message, lawyer_id, client_id });
        res.status(500).json({ message: 'Error adding rating', error: error.message });
    }
}

// Update the lawyer's average rating after adding a new rating
async function updateLawyerRatingOnAdd(lawyer_id, newRating) {
    const lawyerRef = ref(database, `lawyers/${lawyer_id}`);
    try {
        const lawyerSnapshot = await get(lawyerRef);
        if (!lawyerSnapshot.exists()) {
            logger.error('Lawyer not found for ID: ' + lawyer_id);
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
        logger.info(`Updated lawyer ${lawyer_id} with new average rating: ${newAverageRating}`);
    } catch (error) {
        logger.error('Error updating lawyer rating on add for ID ' + lawyer_id + ': ' + error.message, { error });
        throw new Error('Failed to update lawyer rating due to error: ' + error.message);
    }
}

// Function to update an existing rating
async function updateRating(req, res) {
    const { rating_id } = req.params;
    const { ratings, comment_text } = req.body;

    if (!rating_id) {
        logger.warn('Rating ID is required');
        return res.status(400).json({ message: 'Rating ID is required' });
    }
    if (ratings !== undefined && (isNaN(ratings) || ratings < 1 || ratings > 5)) {
        logger.warn('Invalid ratings submitted', { ratings });
        return res.status(400).json({ message: 'Invalid ratings. Must be a number between 1 and 5.' });
    }

    try {
        const ratingRef = ref(database, `lawyer_ratings/${rating_id}`);
        const ratingSnapshot = await get(ratingRef);
        if (!ratingSnapshot.exists()) {
            logger.warn('Rating not found for ID: ' + rating_id);
            return res.status(404).json({ message: 'Rating not found' });
        }

        const oldRating = ratingSnapshot.val().ratings;
        const lawyer_id = ratingSnapshot.val().lawyer_id;

        const updates = {};
        if (ratings !== undefined) updates.ratings = ratings;
        if (comment_text !== undefined) updates.comment_text = comment_text;

        await update(ratingRef, updates);
        logger.info('Rating updated successfully', { rating_id });

        if (ratings !== undefined && ratings !== oldRating) {
            await updateLawyerRatingOnEdit(lawyer_id, oldRating, ratings);
        }

        return res.status(200).json({ message: 'Rating updated successfully', ratingId: rating_id });
    } catch (error) {
        logger.error('Error updating rating', { rating_id, error: error.message });
        return res.status(500).json({ message: 'Error updating rating', error: error.message });
    }
}


// Update the lawyer's average rating after editing an existing rating
async function updateLawyerRatingOnEdit(lawyer_id, oldRating, newRating) {
    const lawyerRef = ref(database, `lawyers/${lawyer_id}`);
    try {
        const lawyerSnapshot = await get(lawyerRef);
        if (!lawyerSnapshot.exists()) {
            logger.error('Lawyer not found for ID: ' + lawyer_id);
            throw new Error('Lawyer not found');
        }

        const lawyerData = lawyerSnapshot.val();
        const currentAverageRating = parseFloat(lawyerData.rating) || 0;
        const ratingCount = parseInt(lawyerData.rating_count) || 1;

        const newTotal = (currentAverageRating * ratingCount - oldRating + newRating);
        const newAverageRating = (newTotal / ratingCount).toFixed(2);

        await update(lawyerRef, { rating: newAverageRating });
        logger.info(`Updated lawyer ${lawyer_id} with new average rating: ${newAverageRating}`);
    } catch (error) {
        logger.error('Error updating lawyer rating on edit for ID ' + lawyer_id + ': ' + error.message, { lawyer_id, error });
        throw new Error('Failed to update lawyer rating due to error: ' + error.message);
    }
}


// Function to delete a rating
async function deleteRating(req, res) {
    const { rating_id } = req.params;

    if (!rating_id) {
        logger.error('Rating ID required but not provided');
        return res.status(400).json({ message: 'Rating ID is required' });
    }

    try {
        const ratingRef = ref(database, `lawyer_ratings/${rating_id}`);
        const ratingSnapshot = await get(ratingRef);
        if (!ratingSnapshot.exists()) {
            logger.warn(`Rating not found: ${rating_id}`);
            return res.status(404).json({ message: 'Rating not found' });
        }

        const lawyer_id = ratingSnapshot.val().lawyer_id;
        const oldRating = ratingSnapshot.val().ratings;

        await remove(ratingRef);
        logger.info(`Rating deleted successfully: ${rating_id}`);
        await updateLawyerRatingOnDelete(lawyer_id, oldRating);

        return res.status(200).json({ message: 'Rating deleted successfully' });
    } catch (error) {
        logger.error(`Error deleting rating: ${error}`);
        return res.status(500).json({ message: 'Error deleting rating', error: error.message });
    }
}

async function updateLawyerRatingOnDelete(lawyer_id, oldRating) {
    const lawyerRef = ref(database, `lawyers/${lawyer_id}`);
    try {
        const lawyerSnapshot = await get(lawyerRef);
        if (!lawyerSnapshot.exists()) {
            logger.error(`Lawyer not found: ${lawyer_id}`);
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
            logger.info(`Updated lawyer ${lawyer_id} with new average rating: ${newAverageRating}`);
        } else {
            await update(lawyerRef, { rating: "0.0", rating_count: 0 });
            logger.info(`Reset rating for lawyer ${lawyer_id} after last rating deletion.`);
        }
    } catch (error) {
        logger.error(`Error updating lawyer rating on delete: ${error}`);
        throw new Error('Failed to update lawyer rating due to error: ' + error.message);
    }
}


async function getAllRatingsByLawyerWithClients(req, res) {
    const { lawyer_id } = req.params;  // Assume lawyer_id is passed as a URL parameter

    if (!lawyer_id) {
        logger.error('Lawyer ID is required but not provided.');
        return res.status(400).json({ message: 'Lawyer ID is required' });
    }

    const ratingsRef = ref(database, 'lawyer_ratings');
    try {
        const allRatingsSnapshot = await get(ratingsRef);
        if (!allRatingsSnapshot.exists()) {
            logger.warn(`No ratings found for lawyer ID: ${lawyer_id}`);
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
            logger.warn(`No ratings found for lawyer after filtering: ${lawyer_id}`);
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
                logger.warn(`Client details not found for client ID: ${clientId}`);
            }
        }

        // Append client details to each rating
        ratings = ratings.map(rating => {
            rating.client = clients[rating.client_id] || { message: 'Client details not found' };
            return rating;
        });

        logger.info(`Ratings with client data retrieved successfully for lawyer ID: ${lawyer_id}`);
        return res.status(200).json(ratings);
    } catch (error) {
        logger.error('Error retrieving ratings with client details:', error);
        return res.status(500).json({ message: 'Error retrieving ratings', error: error.toString() });
    }
}




// Function to add a view to a lawyer's profile
async function addViewToLawyerProfile (req, res)  {
    const { client_id, lawyer_id } = req.body;

    if (!client_id || !lawyer_id) {
        logger.error('Missing client_id or lawyer_id');
        return res.status(400).json({ message: 'Client ID and Lawyer ID are required.' });
    }

    try {
        const viewsRef = ref(database, 'lawyer_profile_views');
        const newViewRef = push(viewsRef);
        const added_at = new Date().toISOString();

        const viewData = {
            client_id,
            lawyer_id,
            added_at
        };

        await set(newViewRef, viewData);
        logger.info(`View added successfully: ${newViewRef.key}`);
        res.status(201).json({ message: 'Profile view added successfully', viewId: newViewRef.key });
    } catch (error) {
        logger.error('Error adding profile view', error);
        res.status(500).json({ message: 'Failed to add profile view', error: error.toString() });
    }
};

// Function to get all views for a specific lawyer
async function getViewsByLawyerId (req, res) {
    const { lawyer_id } = req.params; // Assume lawyer_id is passed as a URL parameter

    const viewsRef = ref(database, 'lawyer_profile_views');
    try {
        const viewsSnapshot = await get(viewsRef);
        let views = [];
        if (viewsSnapshot.exists()) {
            viewsSnapshot.forEach((childSnapshot) => {
                const view = childSnapshot.val();
                if (view.lawyer_id === lawyer_id) {
                    views.push({
                        view_id: childSnapshot.key,
                        ...view
                    });
                }
            });
        }

        if (views.length === 0) {
            logger.info('No views found for this lawyer');
            return res.status(404).json({ message: 'No views found for this lawyer' });
        }

        logger.info(`Views retrieved successfully for lawyer ID: ${lawyer_id}`);
        res.status(200).json(views);
    } catch (error) {
        logger.error('Error retrieving views by lawyer ID', error);
        res.status(500).json({ message: 'Failed to retrieve views', error: error.toString() });
    }
};

async function createLawyerVerification(req, res) {
    const { lawyer_id, first_name, last_name, registration_no } = req.body;

    // Validate input
    if (!lawyer_id || !first_name || !last_name || !registration_no) {
        return res.status(400).json({ message: "All fields are required." });
    }

    const verificationRef = ref(database, `lawyer_verification/${lawyer_id}`);
    const verificationData = {
        first_name,
        last_name,
        registration_no
    };

    try {
        await set(verificationRef, verificationData);
        logger.info("Lawyer verification created successfully", { lawyer_id });
        return res.status(201).json({ message: "Verification created successfully.", verificationData });
    } catch (error) {
        logger.error("Failed to create verification", { error: error.message });
        return res.status(500).json({ message: "Failed to create verification", error: error.message });
    }
}

async function deleteLawyerVerification(req, res) {
    const { lawyer_id } = req.params;

    if (!lawyer_id) {
        return res.status(400).json({ message: "Lawyer ID is required." });
    }

    const verificationRef = ref(database, `lawyer_verification/${lawyer_id}`);

    try {
        await remove(verificationRef);
        logger.info("Lawyer verification deleted successfully", { lawyer_id });
        return res.status(200).json({ message: "Verification deleted successfully." });
    } catch (error) {
        logger.error("Failed to delete verification", { error: error.message });
        return res.status(500).json({ message: "Failed to delete verification", error: error.message });
    }
}

module.exports = { addLawyer, getAllLawyers, getLawyerById, registerLawyer, initiateLawyerRegistration, 
    uploadTestController, updateLawyer, addRating, updateRating,getAllRatingsByLawyerWithClients,
     deleteRating, addViewToLawyerProfile, getViewsByLawyerId, createLawyerVerification, deleteLawyerVerification };

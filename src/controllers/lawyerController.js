const Lawyer = require('../models/lawyerModel');
const { ref, set, push, getDatabase } = require('firebase/database');
const { ref: storageRef, uploadBytes, getDownloadURL } = require('firebase/storage');
const { storage } = require('../utils/firebaseConfig'); // adjust the path to your firebaseConfig module
const database = getDatabase();
const bcrypt = require('bcrypt');
const saltRounds = 10;

async function uploadImageToFirebaseStorage(fileBuffer, fileName) {
    const fileRef = storageRef(storage, 'images/' + fileName); // Create a reference to 'images/fileName'
    try {
        const snapshot = await uploadBytes(fileRef, fileBuffer);
        const url = await getDownloadURL(snapshot.ref);
        return url;
    } catch (error) {
        console.error('Upload failed:', error);
        throw new Error('Failed to upload image');
    }
}

const addLawyer = async (req, res) => {
    console.log("Starting to process adding a new lawyer");

    try {
        console.log("Received request body: ", req.body);

        const {
            first_name, last_name, email, fees, ph_number, address,
            password, years_of_experience, universities,
            rating, verified, account_type
        } = req.body;

        console.log("Parsed data from request");

        const specializations = JSON.parse(req.body.specializations || '[]');
        console.log("Specializations parsed:", specializations);

        let profilePictureUrl = "default.jpg";  // Default profile picture
        console.log("Default profile picture URL set");

        if (req.file) {
            console.log("Received file with name:", req.file.originalname);
            try {
                profilePictureUrl = await uploadImageToFirebaseStorage(req.file.buffer, req.file.originalname);
                console.log("Image successfully uploaded to Firebase Storage:", profilePictureUrl);
            } catch (err) {
                console.error("Failed to upload image:", err);
                return res.status(500).json({ message: "Failed to upload image", error: err.message });
            }
        } else {
            console.log("No file received for upload");
        }

        console.log("Hashing password...");
        const passwordHash = await bcrypt.hash(password, saltRounds);
        console.log("Password hashed successfully");

        console.log("Creating new lawyer object");
        const newLawyer = new Lawyer({
            first_name, last_name, email, fees, ph_number, address,
            passwordHash, // Use the hashed password
            specializations, years_of_experience, universities,
            rating, profilePictureUrl, verified, account_type
        });

        console.log("Pushing new lawyer to database...");
        const lawyerRef = push(ref(database, 'lawyers'));
        await set(lawyerRef, newLawyer.serialize());
        console.log("Lawyer added successfully, ID:", lawyerRef.key);

        res.status(201).json({ message: 'Lawyer added successfully', lawyerId: lawyerRef.key });
    } catch (error) {
        console.error("Error in adding lawyer:", error);
        res.status(500).json({ message: 'Error adding lawyer', error: error.message });
    }
};


const getAllLawyers = async (req, res) => {
    try {
        const lawyerRef = ref(database, 'lawyers');
        const snapshot = await get(lawyerRef);
        const lawyers = snapshot.val();

        if (!lawyers) {
            return res.status(404).json({ message: 'No lawyers found' });
        }

        const lawyerArray = Object.keys(lawyers).map(key => ({
            lawyer_id: key,
            ...lawyers[key]
        }));

        res.status(200).json(lawyerArray);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving lawyers', error: error.message });
    }
};

module.exports = { addLawyer, getAllLawyers };

const Lawyer = require('../models/lawyerModel');
const { ref, set, push, getDatabase, get } = require('firebase/database');
const { ref: storageRef, uploadBytes, getDownloadURL } = require('firebase/storage');
const { storage } = require('../utils/firebaseConfig');
const axios = require('axios');

const database = getDatabase();
const bcrypt = require('bcrypt');
const saltRounds = 10;

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

async function addLawyer(req, res) {
    console.log("Starting to process adding a new lawyer");
    try {
        const {
            first_name, last_name, email, fees, ph_number, address,
            password, years_of_experience, universities,
            rating, verified, account_type
        } = req.body;

        console.log("Parsed data from request:", req.body);
        const specializations = JSON.parse(req.body.specializations || '[]');
        console.log("Specializations parsed:", specializations);

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

        if (!profile_picture || profile_picture === "default.jpg") {
            console.error("Valid profile picture URL not obtained, defaulting to placeholder.");
        }

        console.log("Hashing password...");
        const passwordHash = await bcrypt.hash(password, saltRounds);
        console.log("Password hashed successfully");

        const newLawyer = new Lawyer({
            first_name, last_name, email, fees, ph_number, address,
            passwordHash, specializations, years_of_experience, universities,
            rating, profile_picture, verified, account_type
        });

        console.log("New lawyer object:", newLawyer);

        const lawyerRef = push(ref(database, 'lawyers'));
        await set(lawyerRef, newLawyer.serialize());
        console.log("Lawyer added successfully, ID:", lawyerRef.key);

        res.status(201).json({ message: 'Lawyer added successfully', lawyerId: lawyerRef.key });
    } catch (error) {
        console.error("Error in adding lawyer:", error);
        res.status(500).json({ message: 'Error adding lawyer', error: error.message });
    }
}






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

const Admin = require('../models/adminModel');
const { ref, set, push, onValue } = require('firebase/database');
const { ref: storageRef, uploadBytes, getDownloadURL } = require('firebase/storage');
const { storage, database, getClientByEmail, getLawyerByEmail } = require('../config/firebaseConfig');
const axios = require('axios');

const logger = require('../utils/logger');

const bcrypt = require('bcrypt');
const saltRounds = 10; // Recommended number of salt rounds



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

const registerAdmin = async (req, res) => {
    try {
        console.log("Received data:", req.body);

        const { first_name, last_name, email, ph_number, address, account_type, password } = req.body;

        if (!first_name || !last_name || !email || !ph_number || !address || !account_type || !password) {
            logger.error('Missing required fields in admin registration');
            return res.status(400).json({ message: "Missing required fields" });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        let imageUrl = "default.jpg";
        if (req.file) {
            console.log("Image Received");
            imageUrl = await uploadImageToFirebaseStorage(req.file.buffer, req.file.originalname);
        }
        else{
            console.log("Image Not Received");
        }

        const newAdmin = new Admin({
            first_name, 
            last_name, 
            email, 
            ph_number, 
            address, 
            profile_picture: imageUrl, // the image URL from the upload or default
            account_type, 
            passwordHash: hashedPassword
        });
        
        console.log("last name", last_name);
        console.log("Serialized Admin Data:", newAdmin.serialize());
        const adminRef = push(ref(database, 'admins'));
        await set(adminRef, newAdmin.serialize());

        logger.info('Admin registered successfully:', adminRef.key);
        res.status(201).json({ message: 'Admin registered successfully', adminId: adminRef.key });
    } catch (error) {
        logger.error('Error registering admin:', error);
        console.error("Error registering admin:", error);
        res.status(500).json({ message: 'Error registering admin', error: error.message });
    }
};


const getAllAdmins = async (req, res) => {
    try {
        const adminRef = ref(database, 'admins');
        onValue(adminRef, (snapshot) => {
            const admins = snapshot.val();
            if (!admins) {
                logger.info('No admins found');
                return res.status(404).json({ message: 'No admins found' });
            }
            const adminArray = Object.keys(admins).map(key => ({
                admin_id: key,
                ...admins[key]
            }));
            logger.info('Admins retrieved successfully');
            res.status(200).json(adminArray);
        }, {
            onlyOnce: true
        });
    } catch (error) {
        logger.error('Error retrieving admins:', error);
        console.error("Error retrieving admins:", error);
        res.status(500).json({ message: 'Error retrieving admins', error: error.message });
    }
};

module.exports = { registerAdmin, getAllAdmins };

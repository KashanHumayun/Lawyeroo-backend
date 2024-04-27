const Admin = require('../models/adminModel');
const { ref, set, push, onValue } = require('firebase/database');
const { database } = require('../config/firebaseConfig'); // Corrected import
const logger = require('../utils/logger');


const registerAdmin = async (req, res) => {
    try {
        const { first_name, last_name, email, ph_number, address, profile_picture, account_type, password } = req.body;

        if (!first_name || !last_name || !email || !ph_number || !address || !profile_picture || !account_type || !password) {
            logger.error('Missing required fields in admin registration');
            return res.status(400).json({ message: "Missing required fields" });
        }

        const newAdmin = new Admin({
            first_name, last_name, email, ph_number, address, profile_picture, account_type, password
        });

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

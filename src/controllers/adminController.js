const Admin = require('../models/adminModel');
const { ref, set, push, onValue} = require('firebase/database');
const database = require('../utils/firebaseConfig');

const registerAdmin = async (req, res) => {
    try {
        // Extracting data from request body
        const { first_name, last_name, email, ph_number, address, profile_picture, account_type, password } = req.body;

        // Check if all required fields are present
        if (!first_name || !last_name || !email || !ph_number || !address || !profile_picture || !account_type || !password) {
            return res.status(400).json({ message: "Missing required fields" });
        }
        
        // Create a new Admin instance
        const newAdmin = new Admin(first_name, last_name, email, ph_number, address, profile_picture, account_type, password);

        // Save to Firebase
        const adminRef = push(ref(database, 'admins'));
        await set(adminRef, newAdmin.serialize());

        res.status(201).json({ message: 'Admin registered successfully', adminId: adminRef.key });
    } catch (error) {
        res.status(500).json({ message: 'Error registering admin', error: error.message });
    }
};
// Function to get all admins
const getAllAdmins = async (req, res) => {
    try {
        const adminRef = ref(database, 'admins');
        onValue(adminRef, (snapshot) => {
            const admins = snapshot.val();
            if (!admins) {
                return res.status(404).json({ message: 'No admins found' });
            }
            // Convert object to array
            const adminArray = Object.keys(admins).map(key => ({
                admin_id: key,
                ...admins[key]
            }));
            res.status(200).json(adminArray);
        }, {
            onlyOnce: true // Ensures the listener is triggered only once
        });
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving admins', error: error.message });
    }
};



  
  
module.exports = { registerAdmin, getAllAdmins};

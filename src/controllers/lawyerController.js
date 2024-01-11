const Lawyer = require('../models/lawyerModel');
const { ref, set, push, getDatabase,get} = require('firebase/database');
const database = getDatabase();

const addLawyer = async (req, res) => {
    try {
        const { 
            first_name, last_name, email, fees, ph_number, address, 
            password, specializations, years_of_experience, universities, 
            rating, profile_picture, verified, account_type 
        } = req.body;
        
        // Validate input and handle password hashing if needed

        // Check if profile_picture is provided, otherwise set it to "default.jpg"
        const lawyerProfilePicture = profile_picture?.trim() || "default.jpg";

        // Create a new Lawyer object
        const newLawyer = new Lawyer(
            first_name, last_name, email, fees, ph_number, address, 
            password, specializations, years_of_experience, universities, 
            rating, lawyerProfilePicture, verified, account_type
        );
        console.log(newLawyer);
        // Push the new lawyer data to the database
        const lawyerRef = push(ref(database, 'lawyers'));
        await set(lawyerRef, newLawyer.serialize());

        res.status(201).json({ message: 'Lawyer added successfully', lawyerId: lawyerRef.key });
    } catch (error) {
        res.status(500).json({ message: 'Error adding lawyer', error: error.message });
    }
};



// Function to get all lawyers
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

// routes/clientRoutes.js
const express = require('express');
const router = express.Router();
const upload = require('../middleware/fileUpload'); // Ensure this imports your multer configuration
const { addClient, getAllClients, initiateClientRegistration, registerClient } = require('../controllers/clientController');

// Modify the POST route to include multer middleware for handling the profile_picture
router.post('/add-client', upload.single('profile_picture'), addClient);

// GET endpoint to retrieve all clients
router.get('/', getAllClients);


// POST endpoint to initiate the registration of a new Client, including file upload handling
router.post('/register-client', upload.single('profile_picture'), initiateClientRegistration);

// POST endpoint to complete registration after OTP verification
router.post('/register-complete', upload.single('profile_picture'), registerClient);

module.exports = router;

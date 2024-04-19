// routes/clientRoutes.js
const express = require('express');
const router = express.Router();
const upload = require('../middleware/fileUpload'); // Ensure this imports your multer configuration
const { addClient, getAllClients } = require('../controllers/clientController');

// Modify the POST route to include multer middleware for handling the profile_picture
router.post('/add-client', upload.single('profile_picture'), addClient);

// GET endpoint to retrieve all clients
router.get('/clients', getAllClients);

module.exports = router;

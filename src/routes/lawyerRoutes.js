const express = require('express');
const router = express.Router();
const upload = require('../middleware/fileUpload'); // This imports multer configuration
const authenticateTokenAndRole = require('../middleware/authenticateTokenAndRole'); // Adjust the path as necessary
const { addLawyer,initiateLawyerRegistration, registerLawyer, getAllLawyers, uploadTestController, updateLawyer } = require('../controllers/lawyerController');

// POST endpoint to add a new lawyer. Includes multer middleware for handling file uploads
router.post('/add-lawyer', upload.single('profile_picture'), addLawyer);

// Using the role-checking middleware to protect the route
router.get('/', authenticateTokenAndRole(['clients']), getAllLawyers);


// POST endpoint to initiate the registration of a new lawyer, including file upload handling
router.post('/register-lawyer', upload.single('profile_picture'), initiateLawyerRegistration);

// POST endpoint to complete registration after OTP verification
router.post('/register-complete', upload.single('profile_picture'), registerLawyer);

//PUT endpoint to update a Lawyer
router.put('/update-lawyer/:id', upload.single('profile_picture'), updateLawyer);

// New POST endpoint to test image upload
router.post('/test-upload', upload.single('profile_picture'), uploadTestController);


module.exports = router;



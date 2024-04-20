const express = require('express');
const router = express.Router();
const upload = require('../middleware/fileUpload'); // This imports multer configuration
const { addLawyer,initiateLawyerRegistration, registerLawyer, getAllLawyers, uploadTestController } = require('../controllers/lawyerController');

// POST endpoint to add a new lawyer. Includes multer middleware for handling file uploads
router.post('/add-lawyer', upload.single('profile_picture'), addLawyer);

// GET endpoint to retrieve all lawyers
router.get('/', getAllLawyers);

// POST endpoint to initiate the registration of a new lawyer, including file upload handling
router.post('/register-lawyer', upload.single('profile_picture'), initiateLawyerRegistration);

// POST endpoint to complete registration after OTP verification
router.post('/register-complete', upload.single('profile_picture'), registerLawyer);

// New POST endpoint to test image upload
router.post('/test-upload', upload.single('profile_picture'), uploadTestController);


module.exports = router;



const express = require('express');
const router = express.Router();
const upload = require('../middleware/fileUpload'); // This imports multer configuration
const { addLawyer, getAllLawyers } = require('../controllers/lawyerController');

// POST endpoint to add a new lawyer. Includes multer middleware for handling file uploads
router.post('/add-lawyer', upload.single('profile_picture'), addLawyer);

// GET endpoint to retrieve all lawyers
router.get('/lawyers', getAllLawyers);

module.exports = router;



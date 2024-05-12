const express = require('express');
const router = express.Router();
const upload = require('../middleware/fileUpload'); // This imports multer configuration
const authenticateTokenAndRole = require('../middleware/authenticateTokenAndRole'); // Adjust the path as necessary
const { addLawyer,initiateLawyerRegistration, registerLawyer,getLawyerById,  getAllLawyers, uploadTestController, 
    updateLawyer, addRating, updateRating, getAllRatingsByLawyerWithClients ,deleteRating, getViewsByLawyerId, 
    addViewToLawyerProfile, createLawyerVerification, deleteLawyerVerification, getNearbyLawyers} = require('../controllers/lawyerController');

// POST endpoint to add a new lawyer. Includes multer middleware for handling file uploads
router.post('/add-lawyer', upload.single('profile_picture'), addLawyer);


router.get('/:lawyerId',authenticateTokenAndRole(['clients', 'lawyers', 'admins']), getLawyerById);

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

// Example of using one of the imported functions
router.post('/ratings', authenticateTokenAndRole(['clients','admins']), addRating);
router.put('/ratings/:rating_id', authenticateTokenAndRole(['clients','admins']),updateRating);
router.delete('/ratings/:rating_id',authenticateTokenAndRole(['clients', 'admins']), deleteRating);
router.get('/ratings/:lawyer_id',authenticateTokenAndRole(['clients','lawyers', 'admins']),getAllRatingsByLawyerWithClients);
// Route to add a view to a lawyer's profile
router.post('/add-view', authenticateTokenAndRole(['clients', 'lawyers', 'admins']), addViewToLawyerProfile);

// Route to get all views for a specific lawyer
router.get('/:lawyer_id/views', authenticateTokenAndRole(['lawyers', 'admins', 'clients']), getViewsByLawyerId);


// POST endpoint to create a lawyer verification
router.post('/lawyer-verification', authenticateTokenAndRole(['admins', 'lawyers']), createLawyerVerification);

// DELETE endpoint to delete a lawyer verification
router.delete('/lawyer-verification/:lawyer_id', authenticateTokenAndRole(['admins',  'lawyers']), deleteLawyerVerification);

// Get Nearby Lawyers
router.post('/nearby-lawyers', authenticateTokenAndRole(['clients']), getNearbyLawyers)

module.exports = router;

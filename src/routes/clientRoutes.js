const express = require('express');
const router = express.Router();
const upload = require('../middleware/fileUpload'); // Ensure this imports your multer configuration
const authenticateTokenAndRole = require('../middleware/authenticateTokenAndRole'); // Adjust the path as necessary

const {
    addClient,
    getAllClients,
    initiateClientRegistration,
    registerClient,
    updateClient,
    getClientById,
    deleteFavoriteLawyer,
    addFavoriteLawyer,
    getAllFavoriteLawyers
} = require('../controllers/clientController');

// Modify the POST route to include multer middleware for handling the profile_picture
router.post('/add-client', upload.single('profile_picture'), addClient);

// GET endpoint to retrieve all clients
router.get('/', getAllClients);

// POST endpoint to initiate the registration of a new Client, including file upload handling
router.post('/register-client', upload.single('profile_picture'), initiateClientRegistration);

// POST endpoint to complete registration after OTP verification
router.post('/register-complete', upload.single('profile_picture'), registerClient);

router.put('/update-client/:id', authenticateTokenAndRole(['clients', 'admins']), upload.single('profile_picture'), updateClient);

router.get('/:id', authenticateTokenAndRole(['clients', 'admins', 'lawyers']), getClientById);

// Adding, deleting, and getting favorite lawyers, ensuring to use the authenticateTokenAndRole middleware correctly
router.post('/favorites', authenticateTokenAndRole(['clients']), addFavoriteLawyer);
router.delete('/:client_id/favorites/:lawyer_id', authenticateTokenAndRole(['clients']), deleteFavoriteLawyer);
router.get('/:client_id/favorites', authenticateTokenAndRole(['clients']), getAllFavoriteLawyers);

module.exports = router;

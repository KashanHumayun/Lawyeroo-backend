const express = require('express');
const router = express.Router();
const upload = require('../middleware/fileUpload'); // Ensure this imports your multer configuration
const { registerAdmin, getAllAdmins, updateAdmin, deleteAdmin } = require('../controllers/adminController');
const authenticateTokenAndRole = require('../middleware/authenticateTokenAndRole'); // Adjust the path as necessary

router.post('/register-admin',upload.single('profile_picture'), (req, res) => {
    console.log(req.body); // Log the request body to verify the data
    registerAdmin(req, res);
  });
  
router.put('/:id',authenticateTokenAndRole(['clients', 'admins']), upload.single('profile_picture'), (req, res) => {
    console.log(req.body); // Log the request body to verify the data
    updateAdmin(req, res);
  });
  // Route to get all admins
router.get('/', getAllAdmins);

router.delete('/:id', authenticateTokenAndRole(['clients', 'admins']), deleteAdmin);

module.exports = router;

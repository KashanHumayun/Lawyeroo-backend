const express = require('express');
const router = express.Router();
const upload = require('../middleware/fileUpload'); // Ensure this imports your multer configuration
const { registerAdmin, getAllAdmins } = require('../controllers/adminController');

router.post('/register-admin',upload.single('profile_picture'), (req, res) => {
    console.log(req.body); // Log the request body to verify the data
    registerAdmin(req, res);
  });
  
  // Route to get all admins
  router.get('/', getAllAdmins);

module.exports = router;

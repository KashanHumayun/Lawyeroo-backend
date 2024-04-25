const express = require('express');
const router = express.Router();
const { login, sendResetPasswordCode, resetPassword } = require('../controllers/loginAndResetController');

// Route to handle user login
router.post('/login', login);

// Route to send a password reset code to the user's email
router.post('/sendResetPasswordCode', sendResetPasswordCode);

// Route to reset the user's password after they provide the OTP
router.post('/resetPassword', resetPassword);

module.exports = router;

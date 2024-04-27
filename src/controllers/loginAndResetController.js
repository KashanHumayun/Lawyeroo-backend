const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { getDatabase, ref, query, orderByChild, equalTo, get, update } = require('firebase/database');
const { getLawyerByEmail, getClientByEmail } = require('../config/firebaseConfig');
const crypto = require('crypto');
const saltRounds = 10;
const logger = require('../utils/logger');


const JWT_SECRET = process.env.JWT_SECRET; // Ensure you have a secure secret key
const sendEmail = require('../utils/emailSender');

let otpStore = {}; // This will store OTPs keyed by user's email



function storeOtp(email, otp, otpExpires, userType) {
    otpStore[email] = { otp, otpExpires, userType }; // Store user type along with OTP
    setTimeout(() => {
        delete otpStore[email]; // Automatically delete OTP after expiry
    }, otpExpires - Date.now());
}



const generateToken = (user) => {
    return jwt.sign({
        id: user.id,
        email: user.email,
        userType: user.userType
    }, JWT_SECRET, { expiresIn: '1h' }); // Token expires in one hour
};

exports.login = async (req, res) => {
    const { email, password } = req.body;
    logger.info("Attempting login", { email });

    if (!email || !password) {
        logger.warn("Email or password not provided", { email });
        return res.status(400).json({ message: "Email and password are required." });
    }

    try {
        let userFound = false;
        let userData = null;
        let userType = '';
        const userTypes = ['admins', 'lawyers', 'clients'];

        for (const type of userTypes) {
            const usersRef = ref(database, type);
            const userQuery = query(usersRef, orderByChild('email'), equalTo(email));
            const snapshot = await get(userQuery);

            if (snapshot.exists()) {
                snapshot.forEach((childSnapshot) => {
                    userData = childSnapshot.val();
                    userData.id = childSnapshot.key;
                    userType = type;
                });
                userFound = true;
                break;
            }
        }

        if (!userFound) {
            logger.warn("User not found during login", { email });
            return res.status(404).json({ message: 'Email does not exist.' });
        }

        const passwordIsValid = await bcrypt.compare(password, userData.passwordHash);
        if (!passwordIsValid) {
            logger.warn("Invalid password attempt", { email });
            return res.status(401).json({ message: 'Invalid password.' });
        }

        const token = generateToken({ id: userData.id, email, userType });
        logger.info("Login successful", { email, userType });
        res.status(200).json({ message: 'Login successful', token, userType, userData });
    } catch (error) {
        logger.error("Login error", { email, error: error.message });
        res.status(500).json({ message: 'Error logging in', error: error.message });
    }
};

exports.sendResetPasswordCode = async (req, res) => {
    const { email } = req.body;
    logger.info("Request to send reset password code", { email });

    if (!email || !/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email.trim())) {
        logger.warn("Invalid email format provided for password reset", { email });
        return res.status(400).json({ message: "Invalid email format." });
    }

    try {
        let userType = null;
        const lawyer = await getLawyerByEmail(email);
        const client = await getClientByEmail(email);

        userType = lawyer ? 'lawyers' : client ? 'clients' : null;
        if (!userType) {
            logger.warn("User not found for password reset", { email });
            return res.status(404).json({ message: "No user found with this email." });
        }

        const otp = crypto.randomInt(100000, 999999).toString();
        const otpExpires = Date.now() + 300000; // 5 minutes

        storeOtp(email, otp, otpExpires, userType);
        const message = {
            to: email,
            subject: 'Password Reset Code',
            text: `Your password reset code is ${otp}. This code will expire in 5 minutes.`,
            html: `<strong>Your password reset code is ${otp}</strong>. This code will expire in 5 minutes.`
        };

        await sendEmail(message);
        logger.info("Password reset code sent successfully", { email });
        res.status(200).json({ message: 'Password reset code sent to your email.' });
    } catch (error) {
        logger.error("Error in sending reset password code", { email, error: error.message });
        res.status(500).json({ message: "Failed to send password reset code.", error: error.message });
    }
};

async function updateUserPassword(email, passwordHash) {
    const database = getDatabase();
    const otpData = otpStore[email];
    if (!otpData) {
        logger.error("OTP data not found for email, cannot update password", { email });
        throw new Error("OTP data not found, cannot update password.");
    }

    const { userType } = otpData;
    const usersRef = ref(database, userType);
    const userQuery = query(usersRef, orderByChild('email'), equalTo(email));
    const snapshot = await get(userQuery);

    if (!snapshot.exists()) {
        logger.error("No user found with this email to update the password", { email });
        throw new Error("User not found");
    }

    snapshot.forEach(async (childSnapshot) => {
        const userKey = childSnapshot.key;
        const updatePath = { [`${userType}/${userKey}/passwordHash`]: passwordHash };
        try {
            await update(ref(database), updatePath);
            logger.info("Password updated for user", { userType, email, userKey });
        } catch (error) {
            logger.error("Failed to update password for user", { userType, email, userKey, error: error.message });
        }
    });
}


async function resetPassword(req, res) {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
        logger.warn("Attempt to reset password with missing fields", { email, otpProvided: !!otp });
        return res.status(400).json({ message: "Missing fields. Email, OTP, and new password are required." });
    }

    const otpData = otpStore[email];

    if (!otpData || otpData.otp !== otp || Date.now() > otpData.otpExpires) {
        logger.warn("Invalid or expired OTP used for password reset", { email, otp });
        return res.status(400).json({ message: "Invalid or expired OTP." });
    }

    try {
        const passwordHash = await bcrypt.hash(newPassword, saltRounds);
        await updateUserPassword(email, passwordHash); // Function to update the password in the database

        // Clear OTP from store after successful reset
        delete otpStore[email];

        logger.info("Password successfully updated after reset", { email });
        res.status(200).json({ message: 'Password updated successfully.' });
    } catch (error) {
        logger.error("Error in resetting password", { email, error: error.message });
        res.status(500).json({ message: "Failed to reset password.", error: error.message });
    }
}

module.exports = { login, sendResetPasswordCode, resetPassword};

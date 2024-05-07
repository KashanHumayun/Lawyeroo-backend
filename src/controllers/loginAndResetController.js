const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { getDatabase, ref, query, orderByChild, equalTo, get, update } = require('firebase/database');
const { getLawyerByEmail, getClientByEmail, getAdminByEmail } = require('../config/firebaseConfig');
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

const login = async (req, res) => {
    const { email, password } = req.body;
    console.log("email and password ",email, password);
        // Check if email and password are provided
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required." });
        }
    
    const database = getDatabase();

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
                    userData.id = childSnapshot.key; // Capture the user's Firebase ID
                    userType = type;
                });
                userFound = true;
                break;
            }
        }

        if (!userFound) {
            return res.status(404).json({ message: 'Email does not exist.' });
        }

        // Verify hashed password
        const passwordIsValid = await bcrypt.compare(password, userData.passwordHash);
        if (!passwordIsValid) {
            return res.status(401).json({ message: 'Invalid password.' });
        }

        // Generate JWT Token
        const token = generateToken({
            id: userData.id,
            email,
            userType
        });

        // Login successful, return token and user data
        res.status(200).json({
            message: 'Login successful',
            token,
            userType,
            userData
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Error logging in', error: error.message });
    }
};

async function sendResetPasswordCode(req, res) {
    const { email } = req.body;
    console.log('Email:', email);

    // Validate email format
    if (!email || !/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email.trim())) {
        return res.status(400).json({ message: "Invalid email format." });
    }

    try {
        let userType = null;
        const lawyer = await getLawyerByEmail(email);
        const client = await getClientByEmail(email);
        
        if (lawyer) {
            userType = 'lawyers';
        } else if (client) {
            userType = 'clients';
        }

        if (!userType) {
            return res.status(404).json({ message: "No user found with this email." });
        }

        // Generate OTP and expiration
        const otp = crypto.randomInt(100000, 999999).toString();
        const otpExpires = Date.now() + 300000; // OTP expires in 5 minutes

        console.log("Generated OTP:", otp); // Display the generated OTP
        console.log("OTP expiration time:", new Date(otpExpires).toLocaleString()); // Display the expiration time

        storeOtp(email, otp, otpExpires, userType);

        const message = {
            to: email,
            subject: 'Password Reset Code',
            text: `Your password reset code is ${otp}. This code will expire in 5 minutes.`,
            html: `<strong>Your password reset code is ${otp}</strong>. This code will expire in 5 minutes.`
        };

        await sendEmail(message);
        console.log("Password reset code sent to:", email);
        res.status(200).json({ message: 'Password reset code sent to your email.' });
    } catch (error) {
        console.error("Error in sending reset password code:", error);
        res.status(500).json({ message: "Failed to send password reset code.", error: error.message });
    }
}
async function updateUserPassword(email, passwordHash) {
    const database = getDatabase();
    const otpData = otpStore[email];
    if (!otpData) {
        throw new Error("OTP data not found, cannot update password.");
    }

    const { userType } = otpData;
    const usersRef = ref(database, userType);
    const userQuery = query(usersRef, orderByChild('email'), equalTo(email));
    const snapshot = await get(userQuery);

    if (!snapshot.exists()) {
        console.error("No user found with this email to update the password.");
        throw new Error("User not found");
    }

    snapshot.forEach(async (childSnapshot) => {
        const userKey = childSnapshot.key;
        const updatePath = {};
        updatePath[`${userType}/${userKey}/passwordHash`] = passwordHash;
        await update(ref(database), updatePath); // Update the password hash at the specific path
        console.log(`Password updated for ${userType} with email: ${email}`);
    });
}

// Reset a user's password after verifying their OTP
async function resetPassword(req, res) {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
        return res.status(400).json({ message: "Missing fields. Email, OTP, and new password are required." });
    }

    const otpData = otpStore[email];

    if (!otpData || otpData.otp !== otp || Date.now() > otpData.otpExpires) {
        return res.status(400).json({ message: "Invalid or expired OTP." });
    }

    try {
        const passwordHash = await bcrypt.hash(newPassword, saltRounds);
        await updateUserPassword(email, passwordHash); // Function to update the password in the database

        // Clear OTP from store after successful reset
        delete otpStore[email];

        console.log("Password updated for:", email);
        res.status(200).json({ message: 'Password updated successfully.' });
    } catch (error) {
        console.error("Error in resetting password:", error);
        res.status(500).json({ message: "Failed to reset password.", error: error.message });
    }
}

module.exports = { login, sendResetPasswordCode, resetPassword};

const jwt = require('jsonwebtoken');

const secretKey = process.env.JWT_SECRET || 'your-secret-key'; // It's better to keep your secret key in environment variables

// Generate Token
function generateToken(data, expiresIn = '1h') {
    return jwt.sign(data, secretKey, { expiresIn });
}

// Verify Token
function verifyToken(token) {
    try {
        return jwt.verify(token, secretKey);
    } catch (error) {
        return null;
    }
}
module.exports = { generateToken, verifyToken };
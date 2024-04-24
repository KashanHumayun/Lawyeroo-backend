const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET; // Ensure this is securely stored

// Middleware to authenticate token and check user role
const authenticateTokenAndRole = (requiredRole) => {
    return (req, res, next) => {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.sendStatus(401); // Unauthorized if no token is present
        }

        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) {
                return res.sendStatus(403); // Forbidden if token is invalid
            }

            if (user.userType !== requiredRole) {
                return res.status(403).json({ message: "Access denied: unauthorized role" }); // Forbidden if role does not match
            }

            req.user = user; // Store user details in request object
            next(); // Proceed to the next middleware or route handler
        });
    };
};
module.exports = authenticateTokenAndRole;

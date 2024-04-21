require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Import routes
const adminRoutes = require('./src/routes/adminRoutes');
const lawyerRoutes = require('./src/routes/lawyerRoutes');
const loginRoutes = require('./src/routes/loginRoutes');
const clientRoutes = require('./src/routes/clientRoutes');

const app = express();

// Middlewares
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON payloads

// Logging middleware for monitoring requests
app.use((req, res, next) => {
    console.log(req.method, req.path, req.body); // Logs the HTTP method, path, and body of the request
    next(); // Proceeds to the next middleware
});

// Route handlers
app.use('/api/admins', adminRoutes); // Handles all admin related routes
app.use('/api/lawyers', lawyerRoutes); // Handles all lawyer related routes
app.use('/api/clients', clientRoutes); // Handles all client related routes
app.use('/api', loginRoutes); // Handles login functionality

// Server setup
const PORT = process.env.PORT || 3000; // Use the environment variable PORT, or 3000 if it's not set
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`); // Confirms the server is running and on which port
});

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');
const { google } = require('googleapis'); // Import the google object from googleapis
const { storage, database, getLawyerByEmail, getClientByEmail } = require('./src/config/firebaseConfig');
const { addClient } = require('./src/controllers/clientController');
const { addLawyer } = require('./src/controllers/lawyerController');
const app = express();

// Google OAuth Client Setup
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// Import routes
const adminRoutes = require('./src/routes/adminRoutes');
const lawyerRoutes = require('./src/routes/lawyerRoutes');
const loginRoutes = require('./src/routes/loginRoutes');
const clientRoutes = require('./src/routes/clientRoutes');
const reportRoutes = require('./src/routes/reportRoutes');



// Middlewares
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    console.log(req.method, req.path, req.body);
    next();
});

// Google OAuth Routes
app.get('/auth/google', (req, res) => {
    const userType = req.query.userType; // `client` or `lawyer`
    const state = JSON.stringify({ userType });
    const url = client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'],
        state: Buffer.from(state).toString('base64') // Encode state parameter to base64
    });
    res.redirect(url);
});

app.get('/auth/google/callback', async (req, res) => {
    try {
        const { tokens } = await client.getToken(req.query.code);
        client.setCredentials(tokens);

        // Decode state parameter to determine the user type
        const state = JSON.parse(Buffer.from(req.query.state, 'base64').toString('ascii'));
        const userType = state.userType; // 'client' or 'lawyer'

        // Get user information from Google
        const oauth2 = google.oauth2({
            auth: client,
            version: 'v2'
        });

        const userInfo = await oauth2.userinfo.get();
        const { email, name, picture } = userInfo.data;
        const names = name.split(' ');
        const first_name = names[0];
        const last_name = names.slice(1).join(' ');

        // Determine if user exists and handle accordingly
        let user = null;
        if (userType === 'lawyer') {
            user = await getLawyerByEmail(email);
            if (!user) {
                // Register new lawyer
                const newLawyer = {
                    first_name,
                    last_name,
                    email,
                    profile_picture: picture,
                    verified: false,
                    password:"passsword",
                    account_type: 'Lawyer'
                };
                await addLawyer({ body: newLawyer }, res); // Assumes addLawyer handles the request object directly
            } else {
                // Existing lawyer, log in
                res.json({ message: 'Lawyer logged in successfully', userDetails: user });
            }
        } else {
            // Handle logic for clients
            user = await getClientByEmail(email);
            if (!user) {
                // Register new client
                const newClient = {
                    first_name,
                    last_name,
                    email,
                    google_profile: picture,
                    verified: false,
                    password:"passsword",
                    account_type: 'Client'
                };
                await addClient({ body: newClient }, res); // Assumes addClient handles the request object directly
            } else {
                // Existing client, log in
                res.json({ message: 'Client logged in successfully', userDetails: user });
            }
        }
    } catch (error) {
        console.error('Error during Google auth callback:', error);
        res.status(500).send('Authentication failed');
    }
});

// Route handlers
app.use('/api/admins', adminRoutes);
app.use('/api/lawyers', lawyerRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api', loginRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

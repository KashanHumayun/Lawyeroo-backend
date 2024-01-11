// routes/clientRoutes.js
const express = require('express');
const router = express.Router();
const { addClient, getAllClients } = require('../controllers/clientController');

router.post('/add-client', addClient);
router.get('/clients', getAllClients);

module.exports = router;

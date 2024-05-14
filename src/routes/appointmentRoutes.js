const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const authenticateTokenAndRole = require('../middleware/authenticateTokenAndRole'); // Adjust the path as necessary

// Route to create an appointment
router.post('/',authenticateTokenAndRole(['clients', 'admins']) ,appointmentController.createAppointment);

// Route to update an appointment status
router.put('/status',authenticateTokenAndRole(['lawyers', 'admins']), appointmentController.updateAppointmentStatus);

// Route to delete an appointment
router.delete('/:appointment_id',authenticateTokenAndRole(['clients', 'lawyers', 'admins']), appointmentController.deleteAppointment);

// Route to get all appointments for a client or lawyer
router.get('/:user_id', authenticateTokenAndRole(['clients', 'lawyers', 'admins']), appointmentController.getAppointmentsByUser);

router.get('/',authenticateTokenAndRole(['admins']) ,appointmentController.getAllAppointments);

module.exports = router;

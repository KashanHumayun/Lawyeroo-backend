const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');

// Route to create an appointment
router.post('/', appointmentController.createAppointment);

// Route to update an appointment status
router.put('/status', appointmentController.updateAppointmentStatus);

// Route to delete an appointment
router.delete('/:appointment_id', appointmentController.deleteAppointment);

// Route to get all appointments for a client or lawyer
router.get('/:user_id', appointmentController.getAppointmentsByUser);

module.exports = router;

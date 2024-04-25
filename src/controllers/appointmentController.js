// controllers/appointmentController.js
const { ref, push, set, get, child, remove, update } = require('firebase/database');
const { database } = require('../config/firebaseConfig');
const schedule = require('node-schedule');

// Utility to send notifications (pseudo-code)
const sendNotification = async (userId, message) => {
    console.log(`Notify ${userId}: ${message}`);
    // Implement notification logic here (e.g., Firebase Cloud Messaging)
};

// Create a new appointment
exports.createAppointment = async (req, res) => {
    try {
        const { client_id, lawyer_id, appointment_title } = req.body;
        
        // Validate the input
        if (!client_id || !lawyer_id || !appointment_title ) {
            return res.status(400).json({ message: "All fields are required." });
        }

        // Check if the client and lawyer exist
        const clientRef = ref(database, `clients/${client_id}`);
        const lawyerRef = ref(database, `lawyers/${lawyer_id}`);
        const clientSnapshot = await get(clientRef);
        const lawyerSnapshot = await get(lawyerRef);

        if (!clientSnapshot.exists() || !lawyerSnapshot.exists()) {
            return res.status(404).json({ message: "Client or Lawyer not found." });
        }

        // Create the appointment
        const appointmentRef = push(ref(database, 'appointments'));
        const newAppointment = {
            client_id,
            lawyer_id,
            appointment_title,
            created_at: new Date().toISOString(),
            appointment_status: 'pending'  // Initial status
        };

        await set(appointmentRef, newAppointment);

        // // Schedule a reminder 10 minutes before the appointment
        // const date = new Date(appointment_date);
        // const reminderTime = new Date(date.getTime() - 10 * 60000); // 10 minutes before

        // schedule.scheduleJob(reminderTime, function() {
        //     sendNotification(client_id, `Reminder: Your appointment '${appointment_title}' is in 10 minutes.`);
        //     sendNotification(lawyer_id, `Reminder: Your appointment '${appointment_title}' is in 10 minutes.`);
        // });

        res.status(201).json({ message: 'Appointment created successfully', appointment_id: appointmentRef.key });
    } catch (error) {
        console.error("Error creating appointment:", error);
        res.status(500).json({ message: 'Failed to create appointment', error: error.message });
    }
};

// Update appointment status (accept or reject)
exports.updateAppointmentStatus = async (req, res) => {
    const { appointment_id, status, date  } = req.body; // status could be 'accepted' or 'rejected'

    if (!['accepted', 'rejected'].includes(status)) {
        return res.status(400).json({ message: "Invalid status. Only 'accepted' or 'rejected' are allowed." });
    }
    try {
        const appointmentRef = ref(database, `appointments/${appointment_id}`);
        const appointmentSnapshot = await get(appointmentRef);

        if (!appointmentSnapshot.exists()) {
            return res.status(404).json({ message: "Appointment not found." });
        }

        // Update the appointment status
        await update(appointmentRef, { appointment_status: status, appointment_date: date });
        res.status(200).json({ message: `Appointment ${status} successfully.` });
    } catch (error) {
        console.error("Error updating appointment status:", error);
        res.status(500).json({ message: "Failed to update appointment status.", error: error.message });
    }
};

// controllers/appointmentController.js

// Function to get all appointments for a client or lawyer
exports.getAppointmentsByUser = async (req, res) => {
    const { user_id } = req.params;

    try {
        const appointmentsRef = ref(database, 'appointments');
        const appointmentsSnapshot = await get(appointmentsRef);
        const appointments = appointmentsSnapshot.val();
        const userAppointments = [];

        if (appointments) {
            for (const appointment_id in appointments) {
                if (appointments[appointment_id].client_id === user_id || appointments[appointment_id].lawyer_id === user_id) {
                    userAppointments.push({ appointment_id, ...appointments[appointment_id] });
                }
            }
        }

        res.status(200).json({ success: true, data: userAppointments });
    } catch (error) {
        console.error("Error retrieving appointments by user ID:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};


// controllers/appointmentController.js

// Delete an appointment
exports.deleteAppointment = async (req, res) => {
    const { appointment_id } = req.params;

    try {
        const appointmentRef = ref(database, `appointments/${appointment_id}`);
        const appointmentSnapshot = await get(appointmentRef);

        if (!appointmentSnapshot.exists()) {
            return res.status(404).json({ message: "Appointment not found." });
        }

        // Remove the appointment
        await remove(appointmentRef);
        res.status(200).json({ message: "Appointment deleted successfully." });
    } catch (error) {
        console.error("Error deleting appointment:", error);
        res.status(500).json({ message: "Failed to delete appointment.", error: error.message });
    }
};



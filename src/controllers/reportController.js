const { ref, set,  update, remove, get, push } = require('firebase/database');
const Report = require('../models/reportModel');
const { database } = require('../config/firebaseConfig');

exports.addReport = async (req, res) => {
    // Add the current date-time in ISO format to the request body
    const reportData = {
        ...req.body,
        reported_at: new Date().toISOString() // Sets the current date and time
    };

    const newReport = new Report(reportData); // Create a new report object with the current timestamp included
    const reportRef = push(ref(database, 'reports')); // Get a new push reference

    set(reportRef, newReport.serialize()) // Serialize and save the new report
        .then(() => res.status(201).json({
            message: 'Report added successfully',
            reportId: reportRef.key, // Return the unique key of the newly added report
            reportedAt: reportData.reported_at // Optionally return the timestamp as part of the response
        }))
        .catch(error => res.status(500).json({
            message: 'Failed to add report',
            error: error.message
        }));
};


///Just for testing purposes
exports.updateReport = async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const reportRef = ref(database, `reports/${id}`);

    update(reportRef, updates)
        .then(() => res.status(200).json({ message: 'Report updated successfully' }))
        .catch(error => res.status(500).json({ message: 'Failed to update report', error: error.message }));
};

exports.deleteReport = async (req, res) => {
    const { id } = req.params;
    const reportRef = ref(database, `reports/${id}`);

    remove(reportRef)
        .then(() => res.status(200).json({ message: 'Report deleted successfully' }))
        .catch(error => res.status(500).json({ message: 'Failed to delete report', error: error.message }));
};


exports.getAllReports = async (req, res) => {
    const reportsRef = ref(database, 'reports');
    get(reportsRef)
        .then((snapshot) => {
            if (snapshot.exists()) {
                const reports = snapshot.val();
                // Convert the reports object to an array if needed
                const reportsArray = Object.keys(reports).map(key => ({
                    id: key,
                    ...reports[key]
                }));
                res.status(200).json(reportsArray);
            } else {
                res.status(404).json({ message: 'No reports found' });
            }
        })
        .catch(error => {
            console.error('Error fetching reports:', error);
            res.status(500).json({ message: 'Failed to retrieve reports', error: error.message });
        });
};

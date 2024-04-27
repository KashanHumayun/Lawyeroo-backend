const { ref, set,  update, remove, get, push } = require('firebase/database');
const Report = require('../models/reportModel');
const { database } = require('../config/firebaseConfig');
const logger = require('../utils/logger');

exports.addReport = async (req, res) => {
    const reportData = {
        ...req.body,
        reported_at: new Date().toISOString()
    };

    const newReport = new Report(reportData);
    const reportRef = push(ref(database, 'reports'));

    try {
        await set(reportRef, newReport.serialize());
        logger.info('Report added successfully', { reportId: reportRef.key });
        console.log('Report added successfully', { reportId: reportRef.key});
        res.status(201).json({
            message: 'Report added successfully',
            reportId: reportRef.key,
            reportedAt: reportData.reported_at
        });
    } catch (error) {
        logger.error('Failed to add report', { error: error.message });
        res.status(500).json({
            message: 'Failed to add report',
            error: error.message
        });
    }
};


///Just for testing purposes
exports.updateReport = async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const reportRef = ref(database, `reports/${id}`);

    try {
        await update(reportRef, updates);
        logger.info('Report updated successfully', { id });
        res.status(200).json({ message: 'Report updated successfully' });
    } catch (error) {
        logger.error('Failed to update report', { id, error: error.message });
        res.status(500).json({ message: 'Failed to update report', error: error.message });
    }
};


exports.deleteReport = async (req, res) => {
    const { id } = req.params;
    const reportRef = ref(database, `reports/${id}`);

    try {
        await remove(reportRef);
        logger.info('Report deleted successfully', { id });
        res.status(200).json({ message: 'Report deleted successfully' });
    } catch (error) {
        logger.error('Failed to delete report', { id, error: error.message });
        res.status(500).json({ message: 'Failed to delete report', error: error.message });
    }
};



exports.getAllReports = async (req, res) => {
    const reportsRef = ref(database, 'reports');
    try {
        const snapshot = await get(reportsRef);
        if (snapshot.exists()) {
            const reports = snapshot.val();
            const reportsArray = Object.keys(reports).map(key => ({ id: key, ...reports[key] }));
            logger.info('Reports retrieved successfully');
            res.status(200).json(reportsArray);
        } else {
            logger.warn('No reports found');
            res.status(404).json({ message: 'No reports found' });
        }
    } catch (error) {
        logger.error('Error fetching reports', { error: error.message });
        res.status(500).json({ message: 'Failed to retrieve reports', error: error.message });
    }
};

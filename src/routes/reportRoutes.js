const express = require('express');
const router = express.Router();
const { addReport, updateReport, deleteReport, getAllReports } = require('../controllers/reportController');

router.post('/', addReport);
router.put('/:id', updateReport);
router.delete('/:id', deleteReport);
router.get('', getAllReports);  // New route for fetching all reports

module.exports = router;

const express = require('express');
const router = express.Router();
const { addLawyer, getAllLawyers } = require('../controllers/lawyerController');

router.post('/add-lawyer', addLawyer);
router.get('/lawyers', getAllLawyers);

module.exports = router;

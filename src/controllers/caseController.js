const { ref, set, get, update, remove, query, orderByKey, equalTo } = require('firebase/database');
const { database } = require('../config/firebaseConfig');
const logger = require('../utils/logger');
const lawyer_interactions = require('../utils/lawyerInteraction');

async function addCase(req, res) {
    const { client_id, lawyer_id, case_name, case_details, case_type, case_status } = req.body;
    const created_at = new Date().toISOString();
    const updated_at = created_at; // Initially, created_at and updated_at will be the same

    // Reference to the database locations for client and lawyer
    const clientRef = ref(database, `clients/${client_id}`);
    const lawyerRef = ref(database, `lawyers/${lawyer_id}`);

    try {
        // Check if the client exists
        const clientSnapshot = await get(clientRef);
        if (!clientSnapshot.exists()) {
            logger.error('Client not found');
            return res.status(404).json({ message: 'Client not found' });
        }

        // Check if the lawyer exists
        const lawyerSnapshot = await get(lawyerRef);
        if (!lawyerSnapshot.exists()) {
            logger.error('Lawyer not found');
            return res.status(404).json({ message: 'Lawyer not found' });
        }

        // If both exist, proceed to create the case
        const caseRef = ref(database, 'cases/' + Date.now()); // Using current timestamp as a simple unique ID
        lawyer_interactions.addInteraction(client_id, lawyer_id, "case");
        await set(caseRef, {
            client_id,
            lawyer_id,
            case_name,
            case_details,
            case_type,
            created_at,
            updated_at,
            case_status
        });
        logger.info('Case added successfully');
        res.status(201).json({ message: 'Case added successfully', caseId: caseRef.key });
    } catch (error) {
        logger.error('Failed to add case:', error);
        res.status(500).json({ message: 'Failed to add case', error: error.toString() });
    }
}

async function updateCase(req, res) {
    const { case_id } = req.params;
    const updates = req.body;
    updates.updated_at = new Date().toISOString(); // Update the updated_at field to current time

    const caseRef = ref(database, `cases/${case_id}`);
    try {
        await update(caseRef, updates);
        logger.info('Case updated successfully');
        res.status(200).json({ message: 'Case updated successfully' });
    } catch (error) {
        logger.error('Failed to update case:', error);
        res.status(500).json({ message: 'Failed to update case', error: error.toString() });
    }
}

async function deleteCase(req, res) {
    const { case_id } = req.params;

    const caseRef = ref(database, `cases/${case_id}`);
    try {
        await remove(caseRef);
        logger.info('Case deleted successfully');
        res.status(200).json({ message: 'Case deleted successfully' });
    } catch (error) {
        logger.error('Failed to delete case:', error);
        res.status(500).json({ message: 'Failed to delete case', error: error.toString() });
    }
}

async function getCase(req, res) {
    const { case_id } = req.params;

    const caseRef = ref(database, `cases/${case_id}`);
    try {
        const caseSnapshot = await get(caseRef);
        if (caseSnapshot.exists()) {
            logger.info('Case retrieved successfully');
            res.status(200).json(caseSnapshot.val());
        } else {
            logger.info('Case not found');
            res.status(404).json({ message: 'Case not found' });
        }
    } catch (error) {
        logger.error('Failed to retrieve case:', error);
        res.status(500).json({ message: 'Failed to retrieve case', error: error.toString() });
    }
}


async function getAllCasesByUserId(req, res) {
    const { user_id, role } = req.params;

    // Validate the role to ensure it's either 'lawyer' or 'client'
    if (!['lawyer', 'client'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role specified. Must be either lawyer or client.' });
    }

    const roleField = role + '_id';  // 'lawyer_id' or 'client_id'
    const casesRef = ref(database, 'cases');

    try {
        // Fetch all cases
        const allCasesSnapshot = await get(casesRef);
        if (!allCasesSnapshot.exists()) {
            return res.status(404).json({ message: 'No cases found' });
        }

        let cases = [];
        let userDetailsPromises = [];

        allCasesSnapshot.forEach(childSnapshot => {
            let caseData = childSnapshot.val();
            // Filter cases by user_id based on role
            if (caseData[roleField] === user_id) {
                caseData.case_id = childSnapshot.key;  // Include the case ID

                // Fetch additional details for lawyer and client
                userDetailsPromises.push(
                    get(ref(database, `lawyers/${caseData.lawyer_id}`)).then(lawyerSnapshot => {
                        if (lawyerSnapshot.exists()) {
                            caseData.lawyerDetails = lawyerSnapshot.val();
                        } else {
                            caseData.lawyerDetails = { message: 'Lawyer details not found' };
                        }
                    }),
                    get(ref(database, `clients/${caseData.client_id}`)).then(clientSnapshot => {
                        if (clientSnapshot.exists()) {
                            caseData.clientDetails = clientSnapshot.val();
                        } else {
                            caseData.clientDetails = { message: 'Client details not found' };
                        }
                    })
                );

                cases.push(caseData);
            }
        });

        // Resolve all promises to fetch user details
        await Promise.all(userDetailsPromises);

        if (cases.length === 0) {
            logger.info(`No cases found for ${role} ID: ${user_id}`);
            return res.status(404).json({ message: 'No cases found for this user' });
        }

        logger.info(`Cases with additional user data retrieved successfully for ${role} ID: ${user_id}`);
        res.status(200).json(cases);
    } catch (error) {
        logger.error(`Error retrieving cases for ${role} with ID ${user_id}:`, error);
        res.status(500).json({ message: 'Failed to retrieve cases', error: error.toString() });
    }
}

async function getAllCases(req, res) {
    try {
        const casesRef = ref(database, 'cases');
        const allCasesSnapshot = await get(casesRef);

        if (!allCasesSnapshot.exists()) {
            logger.info('No cases found in the database.');
            return res.status(404).json({ message: 'No cases found' });
        }

        let cases = [];
        let userDetailsPromises = [];

        allCasesSnapshot.forEach(childSnapshot => {
            let caseData = childSnapshot.val();
            caseData.case_id = childSnapshot.key; // Include the case ID

            // Fetch additional details for lawyer and client
            userDetailsPromises.push(
                get(ref(database, `lawyers/${caseData.lawyer_id}`)).then(lawyerSnapshot => {
                    if (lawyerSnapshot.exists()) {
                        caseData.lawyerDetails = lawyerSnapshot.val();
                    } else {
                        caseData.lawyerDetails = { message: 'Lawyer details not found' };
                    }
                }),
                get(ref(database, `clients/${caseData.client_id}`)).then(clientSnapshot => {
                    if (clientSnapshot.exists()) {
                        caseData.clientDetails = clientSnapshot.val();
                    } else {
                        caseData.clientDetails = { message: 'Client details not found' };
                    }
                })
            );

            cases.push(caseData);
        });

        // Resolve all promises to fetch user details
        await Promise.all(userDetailsPromises);

        if (cases.length === 0) {
            logger.info('No cases found after filtering.');
            return res.status(404).json({ message: 'No cases found' });
        }

        logger.info('Cases with additional user data retrieved successfully.');
        res.status(200).json(cases);
    } catch (error) {
        logger.error('Error retrieving cases:', error);
        res.status(500).json({ message: 'Failed to retrieve cases', error: error.toString() });
    }
}


module.exports = {
    addCase,
    updateCase,
    deleteCase,
    getCase,
    getAllCasesByUserId,
    getAllCases
};

const { getDatabase, ref, query, orderByChild, equalTo, get } = require('firebase/database');

const login = async (req, res) => {
    const { email, password } = req.body;
    const database = getDatabase();

    try {
        let userFound = false;
        let userData = null;
        let userType = '';

        const userTypes = ['admins', 'lawyers', 'clients'];
        for (const type of userTypes) {
            const usersRef = ref(database, type);
            const userQuery = query(usersRef, orderByChild('email'), equalTo(email));
            const snapshot = await get(userQuery);

            if (snapshot.exists()) {
                snapshot.forEach((childSnapshot) => {
                    userData = childSnapshot.val();
                    userType = type;
                });
                userFound = true;
                break;
            }
        }

        if (!userFound) {
            return res.status(404).json({ message: 'Email does not exist' });
        }

        // Verify password
        if (password !== userData.password) {
            return res.status(401).json({ message: 'Invalid password' });
        }

        // Login successful
        res.status(200).json({ message: 'Login successful', userType, userData });
    } catch (error) {
        res.status(500).json({ message: 'Error logging in', error: error.message });
    }
};

module.exports = { login };

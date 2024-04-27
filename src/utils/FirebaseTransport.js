const Transport = require('winston-transport');
const { ref, push, set } = require('firebase/database');
const { database } = require('../config/firebaseConfig'); // Make sure this path is correct

class FirebaseTransport extends Transport {
    constructor(opts) {
        super(opts);
        console.log("FirebaseTransport initialized"); // Log when the transport is initialized
    }

    log(info, callback) {
        console.log("Attempting to log:", info); // Display the log information being processed

        const logEntry = {
            timestamp: info.timestamp,
            level: info.level,
            message: info.message
        };

        const logsRef = ref(database, 'logs'); // Get a reference to the 'logs' node
        console.log("Firebase reference obtained:", logsRef.toString()); // Log the reference to check correctness

        const newLogRef = push(logsRef); // Create a new push ID for the log entry
        console.log("New log reference created:", newLogRef.toString()); // Log the new log reference

        set(newLogRef, logEntry)
            .then(() => {
                console.log("Log entry added successfully:", logEntry); // Log success
                callback(null, true);
            })
            .catch(error => {
                console.error("Failed to add log entry:", error); // Log failure
                callback(error, false);
            });
    }
}
module.exports = FirebaseTransport;

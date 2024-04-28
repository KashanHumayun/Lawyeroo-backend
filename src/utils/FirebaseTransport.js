const Transport = require('winston-transport');
const { createLogger, format } = require('winston');
const fs = require('fs');
const path = require('path');
const logsDirectory = path.join(__dirname, '..', '..', 'logs');
const logFilePath = path.join(logsDirectory, 'app.log');

// Ensure that the logs directory exists
if (!fs.existsSync(logsDirectory)) {
    fs.mkdirSync(logsDirectory);
}

class FileTransport extends Transport {
    constructor(opts) {
        super(opts);
        console.log("FileTransport initialized"); // Log when the transport is initialized
    }

    log(info, callback) {
        console.log("Attempting to log:", info); // Display the log information being processed

        const logEntry = {
            timestamp: info.timestamp,
            level: info.level,
            message: info.message
        };

        const logString = JSON.stringify(logEntry, null, 2); // Convert log entry to JSON string with pretty formatting

        // Append the log string to the file
        fs.appendFile(logFilePath, logString + '\n', (err) => {
            if (err) {
                console.error("Failed to append log entry to file:", err); // Log failure
                callback(err, false);
            } else {
                console.log("Log entry added to file successfully:", logEntry); // Log success
                callback(null, true);
            }
        });
    }
}



module.exports = FileTransport;

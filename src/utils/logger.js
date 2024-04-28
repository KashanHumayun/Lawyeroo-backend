const { createLogger, format } = require('winston');
const FileTransport = require('./FirebaseTransport');

const logger = createLogger({
    format: format.combine(
        format.timestamp(),
        format.json()
    ),
    transports: [
        new FileTransport()
    ]
});



module.exports = logger;

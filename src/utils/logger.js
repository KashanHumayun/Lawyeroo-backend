const { createLogger, format } = require('winston');
const FirebaseTransport = require('./FirebaseTransport');

const logger = createLogger({
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new FirebaseTransport()
  ]
});

module.exports = logger;

const Transport = require('winston-transport');
const admin = require('firebase-admin');
const db = admin.database();

module.exports = class FirebaseTransport extends Transport {
  constructor(opts) {
    super(opts);
  }

  log(info, callback) {
    setImmediate(() => {
      this.emit('logged', info);
    });

    // Log entry structure
    const logEntry = {
      timestamp: info.timestamp,
      level: info.level,
      message: info.message
    };

    // Push log entry to Firebase
    const logsRef = db.ref('logs');
    logsRef.push(logEntry);

    callback();
  }
};

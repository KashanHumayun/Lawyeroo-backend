const { initializeApp } = require('firebase/app');
const { getStorage } = require('firebase/storage');
const { getDatabase } = require('firebase/database');

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCxLAjeyj8700XQAWiChk...",
  authDomain: "lawyeroo.firebaseapp.com",
  databaseURL: "https://lawyeroo-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "lawyeroo",
  storageBucket: "lawyeroo.appspot.com",
  messagingSenderId: "1067587453247",
  appId: "1:1067587453247:android:60d79fed9b8694dff4d38a"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const storage = getStorage(app);

module.exports = { database, storage };

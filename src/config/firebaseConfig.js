const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, orderByChild,query, equalTo } = require('firebase/database'); // Correctly import ref, orderByChild, equalTo
const { getStorage } = require('firebase/storage');

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

function getLawyerByEmail(email) {
  const lawyersRef = ref(database, 'lawyers'); // Ensure 'ref' is imported
  const queryRef = query(lawyersRef, orderByChild('email'), equalTo(email)); // Use the query function correctly
  return get(queryRef)
    .then(snapshot => {
      if (snapshot.exists()) {
        console.log('Data found:', snapshot.val());
        return snapshot.val();
      } else {
        console.log('No data found for the provided email.');
        return null;
      }
    })
    .catch(error => {
      console.error('Error querying database:', error);
      throw error;
    });
}
function getClientByEmail(email) {
  const clientsRef = ref(database, 'clients'); // Ensure 'ref' is imported
  const queryRef = query(clientsRef, orderByChild('email'), equalTo(email)); // Use the query function correctly
  return get(queryRef)
    .then(snapshot => {
      if (snapshot.exists()) {
        console.log('Data found:', snapshot.val());
        return snapshot.val();
      } else {
        console.log('No data found for the provided email.');
        return null;
      }
    })
    .catch(error => {
      console.error('Error querying database:', error);
      throw error;
    });
}
function getAdminByEmail(email) {
  const clientsRef = ref(database, 'admins'); // Ensure 'ref' is imported
  const queryRef = query(clientsRef, orderByChild('email'), equalTo(email)); // Use the query function correctly
  return get(queryRef)
    .then(snapshot => {
      if (snapshot.exists()) {
        console.log('Data found:', snapshot.val());
        return snapshot.val();
      } else {
        console.log('No data found for the provided email.');
        return null;
      }
    })
    .catch(error => {
      console.error('Error querying database:', error);
      throw error;
    });
}
module.exports = { database, storage, getLawyerByEmail, getClientByEmail, getAdminByEmail };

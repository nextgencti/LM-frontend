const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');
require('dotenv').config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkSub(labId) {
  try {
    const docRef = doc(db, 'subscriptions', labId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      console.log("Subscription Found:", snap.data());
    } else {
      console.log("Subscription NOT FOUND for labId:", labId);
    }
  } catch (e) {
    console.error("Error fetching sub:", e);
  }
}

// I need the labId. I'll try to find it from a booking or report.
// Actually, I'll just check if there are any subscriptions.
checkSub("demo-lab"); // common demo lab id
checkSub("L-9774"); // example from early logs

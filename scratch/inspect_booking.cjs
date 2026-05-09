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

async function inspectBooking(id) {
  try {
    const snap = await getDoc(doc(db, 'bookings', id));
    if (snap.exists()) {
      console.log("Booking found:", snap.data());
    } else {
      console.log("Booking NOT found:", id);
    }
  } catch (e) {
    console.error("Error:", e);
  }
}

inspectBooking("BL-0108");

import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore } from 'firebase/firestore';

// Backend URL — change this if your backend port is different
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

let auth, db, storage;

// Fetch Firebase config from backend and initialize Firebase
export const initFirebase = async () => {
  if (getApps().length > 0) {
    // Already initialized
    const app = getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    return { auth, db, storage };
  }

  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
  };
  const app = initializeApp(firebaseConfig);
  
  auth = getAuth(app);
  
  // Use the new modern API for Offline Caching to avoid the deprecation warning
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
  
  storage = getStorage(app);

  return { auth, db, storage };
};

// Lazy getters — safe to import anywhere; will be populated after initFirebase() runs
export const getAuthInstance = () => auth;
export const getDbInstance = () => db;
export const getStorageInstance = () => storage;

// These are exported for direct use after init
export { auth, db, storage };
export default { initFirebase };

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

  const res = await fetch(`${BACKEND_URL}/api/config`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch Firebase config from backend');
  }

  const firebaseConfig = await res.json();
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

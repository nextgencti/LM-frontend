const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, limit, query } = require('firebase/firestore');

// Hardcoded demo project config (I'll try to find it in the codebase)
const firebaseConfig = {
  projectId: "pathology-software-demo",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkCollection() {
  try {
    const q = query(collection(db, 'testParameters'), limit(1));
    const snap = await getDocs(q);
    console.log("Collection 'testParameters' empty?", snap.empty);
    if (!snap.empty) {
      console.log("First doc data:", snap.docs[0].data());
    }
  } catch (e) {
    console.error("Error:", e);
  }
}

checkCollection();

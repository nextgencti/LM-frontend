const admin = require('firebase-admin');

// Raw string from .env (simplified)
const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT.replace(/'/g, ''); 
const serviceAccount = JSON.parse(serviceAccountRaw);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

async function fix() {
  const email = 'Sanjaymsk12@gmail.com';
  try {
    const user = await auth.getUserByEmail(email);
    console.log('Target User UID:', user.uid);

    // 1. Set Custom Claims
    await auth.setCustomUserClaims(user.uid, { role: 'SuperAdmin' });
    console.log('Custom Claims [role: SuperAdmin] set.');

    // 2. Set Firestore Role
    await db.collection('users').doc(user.uid).set({
      role: 'SuperAdmin',
      email: email,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log('Firestore user document updated with role: SuperAdmin.');

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

fix();

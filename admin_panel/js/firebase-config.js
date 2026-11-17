

const firebaseConfig = {
    apiKey: "YOUR_GOOGLE_API_KEY",
    authDomain: "attendance-79839.firebaseapp.com",
    projectId: "attendance-79839",
    storageBucket: "attendance-79839.firebasestorage.app",
    messagingSenderId: "205434543166",
    appId: "1:205434543166:web:354b4a7e202b3ad09f856f"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

db.enablePersistence().catch(err => {
    if (err.code === 'failed-precondition') {
        console.warn('Firestore persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
        console.warn('Firestore persistence not available in this browser');
    }
});

const firebaseConfig = {
  apiKey:            "AIzaSyDIdl4WVavQDvLS6Ehy1BdJZF8vaO3269Y",
  authDomain:        "autodeck-ai.firebaseapp.com",
  projectId:         "autodeck-ai",
  storageBucket:     "autodeck-ai.firebasestorage.app",
  messagingSenderId: "1054256355272",
  appId:             "1:1054256355272:web:b9eb67bf92f8bbf4d112fd",
};

firebase.initializeApp(firebaseConfig);
window.firebaseAuth = firebase.auth();
try { window.firebaseDb      = firebase.firestore(); } catch(e) { console.warn('Firestore SDK not loaded:', e.message); }
try { window.firebaseStorage = firebase.storage();   } catch(e) { console.warn('Storage SDK not loaded:', e.message); }

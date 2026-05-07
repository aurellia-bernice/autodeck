// ─────────────────────────────────────────────────────────────────────────────
// Firebase Configuration
// Replace the values below with your project's config from the Firebase console:
//   Firebase Console → Project Settings → Your apps → SDK setup and configuration
// ─────────────────────────────────────────────────────────────────────────────
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

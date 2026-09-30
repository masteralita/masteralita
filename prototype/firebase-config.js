'use strict';
// Firebase web app config (public — it only names the project; access is decided by firestore.rules).
// Shared by the game (reads the released balance) and the admin site (admin/).
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyByPuSrYIGObtv4f32s1HlLQBpIja1hRcc",
  authDomain: "galaxywar-e3d9a.firebaseapp.com",
  projectId: "galaxywar-e3d9a",
  storageBucket: "galaxywar-e3d9a.firebasestorage.app",
  messagingSenderId: "983136099060",
  appId: "1:983136099060:web:163630e2a9d58751901ca1"
};
const FIREBASE_DB = 'glaxywardb'; // named Firestore database (서울)

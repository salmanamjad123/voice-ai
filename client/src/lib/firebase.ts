import dotenv from 'dotenv';
dotenv.config();

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// const firebaseConfig = {
//   apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
//   authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
//   projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
//   storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
//   appId: import.meta.env.VITE_FIREBASE_APP_ID,
// };

const firebaseConfig = {
  apiKey: "AIzaSyC98dv8pkoBsHcNBLNtuNjtuup7c-GDHso",
  authDomain: "aiml-9fd3c.firebaseapp.com",
  projectId: "aiml-9fd3c",
  storageBucket: "aiml-9fd3c.firebasestorage.app",
  messagingSenderId: "579784540286",
  appId: "1:579784540286:web:6527364372cccac0bb982f",
  measurementId: "G-6BH7CSB5EC"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyARpZbWuYbW8cxHj4w-24Zwi-LLhk4taZE",
  authDomain: "liniya-kds.firebaseapp.com",
  projectId: "liniya-kds",
  storageBucket: "liniya-kds.firebasestorage.app",
  messagingSenderId: "В837329386469",
  appId: "1:837329386469:web:ad98ff8d5108d03fb6cd0c"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);


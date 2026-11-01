import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyD2JFoeUYOpAWEKuteX7TAkd6KdFtv4WOU",
  authDomain: "gadget-store-4d442.firebaseapp.com",
  projectId: "gadget-store-4d442",
  storageBucket: "gadget-store-4d442.firebasestorage.app",
  messagingSenderId: "292909971795",
  appId: "1:292909971795:web:109f2e0479c6c4a89249a6",
  measurementId: "G-K1B26N9XH8",
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "us-central1");
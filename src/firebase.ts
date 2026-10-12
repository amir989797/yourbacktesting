import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);

export interface UserTradingSettings {
  initialCapital: number;
  riskPercent: number;
  timeframe: string;
  selectedStrategyId: string;
  updatedAt?: string;
}

// Helper to save user activity and settings to Firestore
export async function syncUserDataToFirebase(username: string, data: Partial<UserTradingSettings>) {
  try {
    const userDocRef = doc(db, "users", username);
    await setDoc(userDocRef, {
      username,
      lastLogin: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
    }, { merge: true });
    return true;
  } catch (err) {
    console.warn("Could not sync user data to Firebase:", err);
    return false;
  }
}

// Helper to get user settings from Firestore
export async function getUserDataFromFirebase(username: string): Promise<UserTradingSettings | null> {
  try {
    const userDocRef = doc(db, "users", username);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      return snap.data() as UserTradingSettings;
    }
    return null;
  } catch (err) {
    console.warn("Could not fetch user data from Firebase:", err);
    return null;
  }
}

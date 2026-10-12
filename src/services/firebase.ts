import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

export async function logoutUser() {
  return signOut(auth);
}

export async function saveUserSettings(userId: string, settings: any) {
  try {
    await setDoc(doc(db, 'users', userId), { settings, updatedAt: new Date().toISOString() }, { merge: true });
    return true;
  } catch (e) {
    console.warn('Saving settings to Firestore failed (using local storage fallback):', e);
    return false;
  }
}

export async function loadUserSettings(userId: string) {
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    if (snap.exists()) {
      return snap.data()?.settings;
    }
  } catch (e) {
    console.warn('Failed to load user settings from Firestore (using local fallback):', e);
  }
  return null;
}

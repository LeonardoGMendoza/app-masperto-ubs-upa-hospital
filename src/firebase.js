import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, increment } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBf09erWA43vU3dXmI5_JnRHZnC1aohOQ0",
  authDomain: "app-masperto-ubs-upa-hospital.firebaseapp.com",
  projectId: "app-masperto-ubs-upa-hospital",
  storageBucket: "app-masperto-ubs-upa-hospital.firebasestorage.app",
  messagingSenderId: "794570861236",
  appId: "1:794570861236:web:2ad037fd505a05234245e1"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Custom function to handle user login and points in Firestore
export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    // Check if user exists in Firestore
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      // Create new user profile with 0 points
      await setDoc(userRef, {
        uid: user.uid,
        name: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        points: 0,
        joinedAt: new Date().toISOString()
      });
    }

    return user;
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

export const logout = () => signOut(auth);

// Function to add points to the user (e.g. 50 points per route)
export const addPoints = async (uid, amount) => {
  if (!uid) return;
  const userRef = doc(db, "users", uid);
  await setDoc(userRef, { points: increment(amount) }, { merge: true });
};

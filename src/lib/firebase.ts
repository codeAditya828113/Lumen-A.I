import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInAnonymously } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import defaultFirebaseConfig from '../../firebase-applet-config.json';

// Helper to sanitize environment variables and ignore placeholders, empty strings or literal undefined/null
function getEnv(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  // Strip quotes if they were included literally
  const cleaned = trimmed.replace(/^["']|["']$/g, '').trim();
  if (
    !cleaned ||
    cleaned === 'undefined' ||
    cleaned === 'null' ||
    cleaned === 'placeholder' ||
    cleaned.startsWith('YOUR_') ||
    cleaned.startsWith('<YOUR_') ||
    cleaned.includes('actual_api_key')
  ) {
    return undefined;
  }
  return cleaned;
}

// Support overriding via client-side environment variables on your local machine
const firebaseConfig = {
  apiKey: getEnv(import.meta.env.VITE_FIREBASE_API_KEY) || defaultFirebaseConfig.apiKey,
  authDomain: getEnv(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN) || defaultFirebaseConfig.authDomain,
  projectId: getEnv(import.meta.env.VITE_FIREBASE_PROJECT_ID) || defaultFirebaseConfig.projectId,
  storageBucket: getEnv(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET) || defaultFirebaseConfig.storageBucket,
  messagingSenderId: getEnv(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID) || defaultFirebaseConfig.messagingSenderId,
  appId: getEnv(import.meta.env.VITE_FIREBASE_APP_ID) || defaultFirebaseConfig.appId,
  measurementId: getEnv(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) || defaultFirebaseConfig.measurementId,
  firestoreDatabaseId: getEnv(import.meta.env.VITE_FIREBASE_DATABASE_ID) || defaultFirebaseConfig.firestoreDatabaseId,
};

// Log loaded configuration for debugging (obfuscating apiKey)
console.log('[Firebase] Initializing with Project:', firebaseConfig.projectId, 'Database:', firebaseConfig.firestoreDatabaseId || '(default)');

const app = initializeApp(firebaseConfig);

const databaseId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? firebaseConfig.firestoreDatabaseId
  : undefined;

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, databaseId);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signIn = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Authentication error:", error);
    throw error;
  }
};

export const signInAnon = async () => {
  try {
    const result = await signInAnonymously(auth);
    return result.user;
  } catch (error) {
    console.warn("Anonymous authentication error:", error);
    return null;
  }
};

/**
 * Recursively strips undefined values from an object or array before writing to Firebase Firestore.
 * Firestore throws a runtime error if any property in an object or array has an undefined value.
 * Preserves Firestore FieldValues (such as serverTimestamp()), Dates, and primitives.
 */
export function sanitizeFirestoreData<T>(data: T): T {
  if (data === undefined) {
    return null as any;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (data instanceof Date) {
    return data;
  }
  // Check for Firestore FieldValue / Sentinel transforms
  if (
    typeof (data as any).isEqual === 'function' || 
    (data as any)._methodName || 
    (data as any).constructor?.name === 'FieldValue' ||
    (data as any).constructor?.name === 'ServerTimestampTransform'
  ) {
    return data;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeFirestoreData(item)) as any;
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      clean[key] = sanitizeFirestoreData(value);
    }
  }
  return clean as any;
}


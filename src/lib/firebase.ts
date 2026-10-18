import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInAnonymously } from 'firebase/auth';
import { initializeFirestore, Firestore } from 'firebase/firestore';

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

// Read all Firebase settings ONLY from VITE_FIREBASE_* environment variables (no hardcoded fallbacks)
export const firebaseClientConfig = {
  apiKey: getEnv(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: getEnv(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: getEnv(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: getEnv(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: getEnv(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: getEnv(import.meta.env.VITE_FIREBASE_APP_ID),
  measurementId: getEnv(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID),
  firestoreDatabaseId: getEnv(import.meta.env.VITE_FIREBASE_DATABASE_ID),
};

// Check for missing required variables
const requiredClientKeys: (keyof typeof firebaseClientConfig)[] = [
  'apiKey',
  'authDomain',
  'projectId',
  'appId',
];

export const missingFirebaseConfigKeys = requiredClientKeys.filter(
  (key) => !firebaseClientConfig[key]
);

export const firebaseConfigError: string | null =
  missingFirebaseConfigKeys.length > 0
    ? `Missing required Firebase environment variables: ${missingFirebaseConfigKeys
        .map((k) => `VITE_FIREBASE_${k.replace(/([A-Z])/g, '_$1').toUpperCase()}`)
        .join(', ')}. Please configure them in your .env or .env.local file.`
    : null;

if (firebaseConfigError) {
  console.error(`[Firebase Configuration Error] ${firebaseConfigError}`);
}

// Initialize Firebase App
let app: FirebaseApp;
const existingApps = getApps();
if (existingApps.length > 0) {
  app = existingApps[0];
} else {
  app = initializeApp({
    apiKey: firebaseClientConfig.apiKey || 'missing-api-key',
    authDomain: firebaseClientConfig.authDomain || 'missing-auth-domain',
    projectId: firebaseClientConfig.projectId || 'missing-project-id',
    storageBucket: firebaseClientConfig.storageBucket,
    messagingSenderId: firebaseClientConfig.messagingSenderId,
    appId: firebaseClientConfig.appId || 'missing-app-id',
    measurementId: firebaseClientConfig.measurementId,
  });
}

const customDatabaseId =
  firebaseClientConfig.firestoreDatabaseId &&
  firebaseClientConfig.firestoreDatabaseId !== '(default)'
    ? firebaseClientConfig.firestoreDatabaseId
    : undefined;

export const db: Firestore = initializeFirestore(
  app,
  {
    experimentalForceLongPolling: true,
  },
  customDatabaseId
);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signIn = async () => {
  if (firebaseConfigError) {
    throw new Error(firebaseConfigError);
  }
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Authentication error:', error);
    throw error;
  }
};

export const signInAnon = async () => {
  if (firebaseConfigError) {
    console.warn(`[Firebase Auth] Cannot sign in anonymously: ${firebaseConfigError}`);
    return null;
  }
  try {
    const result = await signInAnonymously(auth);
    return result.user;
  } catch (error) {
    console.warn('Anonymous authentication error:', error);
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

import type { FirebaseOptions } from "firebase/app";

/**
 * NEXT_PUBLIC_* values are inlined at build time, so each must be referenced literally.
 * Firebase web config is not secret; access control is enforced by Security Rules.
 */
const rawConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const REQUIRED_KEYS = ["apiKey", "authDomain", "projectId", "appId"] as const;

export const missingFirebaseConfigKeys: string[] = REQUIRED_KEYS.filter(
  (key) => !rawConfig[key],
);

export const isFirebaseConfigured = missingFirebaseConfigKeys.length === 0;

export const firebaseConfig = rawConfig as FirebaseOptions;

export const useFirebaseEmulators =
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

/** reCAPTCHA v3 site key for Firebase App Check (public). App Check is off when unset. */
export const appCheckSiteKey = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY ?? "";
/** Local/CI only: lets App Check issue debug tokens (register them in the Firebase console). */
export const appCheckDebug = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG === "true";
/** Firebase Performance Monitoring (production). */
export const performanceMonitoring = process.env.NEXT_PUBLIC_FIREBASE_PERFORMANCE === "true";
/** Deployment environment label, e.g. "production" or "staging". */
export const appEnvironment = process.env.NEXT_PUBLIC_APP_ENV ?? "development";

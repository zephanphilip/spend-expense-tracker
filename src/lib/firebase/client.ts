import { type FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { type Auth, connectAuthEmulator, getAuth } from "firebase/auth";
import {
  clearIndexedDbPersistence,
  connectFirestoreEmulator,
  type Firestore,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
} from "firebase/firestore";

import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

import { appCheckDebug, appCheckSiteKey, firebaseConfig, isFirebaseConfigured, useFirebaseEmulators } from "./config";

/*
 * Lazy singletons. Only `lib/services/*` should import from this module so that UI code
 * never touches the Firebase SDK directly.
 */

let auth: Auth | undefined;
let db: Firestore | undefined;

function assertBrowser() {
  if (typeof window === "undefined") {
    throw new Error("Firebase client SDK used during server rendering.");
  }
  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured. Copy .env.example to .env.local.");
  }
}

export function getFirebaseApp(): FirebaseApp {
  assertBrowser();
  if (getApps().length) return getApp();
  const app = initializeApp(firebaseConfig);
  initAppCheck(app);
  return app;
}

/**
 * Firebase App Check: attests requests come from this web app (reCAPTCHA v3), so a leaked
 * API key can't be used from scripts. Enforce it per product in the Firebase console once
 * metrics look healthy. Skipped against emulators.
 */
function initAppCheck(app: FirebaseApp) {
  if (!appCheckSiteKey || useFirebaseEmulators) return;
  if (appCheckDebug) {
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  initializeAppCheck(app, { provider: new ReCaptchaV3Provider(appCheckSiteKey), isTokenAutoRefreshEnabled: true });
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
    if (useFirebaseEmulators) {
      connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    }
  }
  return auth;
}

export function getDb(): Firestore {
  if (!db) {
    const app = getFirebaseApp();
    try {
      // Persistent cache: instant loads from IndexedDB and offline writes that sync later.
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      });
    } catch {
      // Already initialised (e.g. during Fast Refresh) — reuse the existing instance.
      db = getFirestore(app);
    }
    if (useFirebaseEmulators) {
      try {
        connectFirestoreEmulator(db, "127.0.0.1", 8080);
      } catch {
        // Already connected.
      }
    }
  }
  return db;
}

/**
 * Shuts Firestore down and wipes its on-device cache so the next account on a shared
 * device can't read the previous user's expenses from IndexedDB.
 */
export async function resetFirestore(): Promise<void> {
  if (!db) return;
  const instance = db;
  db = undefined;
  await terminate(instance);
  await clearIndexedDbPersistence(instance).catch(() => {
    // Another tab still holds the cache open; it will be replaced on next sign-in.
  });
}

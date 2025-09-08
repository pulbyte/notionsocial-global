import "dotenv/config";
import {applicationDefault, initializeApp, getApps, getApp} from "firebase-admin/app";
import {getAuth as getAuthAdmin, Auth} from "firebase-admin/auth";
import {getFirestore, Firestore, FieldValue} from "firebase-admin/firestore";
import {dog} from "./logging";

let db: Firestore;
let auth: Auth;

function init() {
  dog("Initializing Firebase...");
  return initializeApp({
    credential: applicationDefault(),
  });
}

function initializeFirebaseApp() {
  // Check if Firebase app already exists
  const existingApps = getApps();
  const app = existingApps.length > 0 ? getApp() : init();

  if (!db) {
    db = getFirestore(app);
    db.settings({ignoreUndefinedProperties: true});
  }

  if (!auth) {
    auth = getAuthAdmin();
  }

  return {db, auth};
}

// Lazy initialization - only initialize when needed
function getDb() {
  if (!db) {
    return initializeFirebaseApp().db;
  }
  return db;
}

function getAuth() {
  if (!auth) {
    return initializeFirebaseApp().auth;
  }
  return auth;
}

// Initialize Firebase Admin if not already initialized
function ensureFirebaseInitialized(): void {
  if (getApps().length === 0) {
    init();
  }
}

export {getDb, getAuth, ensureFirebaseInitialized, FieldValue};

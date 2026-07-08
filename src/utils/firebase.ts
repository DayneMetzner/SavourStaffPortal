/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Services
export const db = getFirestore(app);
export const auth = getAuth(app);

// Connection test as required by the Firebase Integration Skill
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, '_test_connection_', 'init'));
    console.log("Firestore connection test: SUCCESS");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore connection test: client appears offline. Please check your Firebase project configuration.");
    } else {
      console.log("Firestore connection test completed (ignoring initial non-existent document or permission warnings).");
    }
  }
}

testFirestoreConnection();

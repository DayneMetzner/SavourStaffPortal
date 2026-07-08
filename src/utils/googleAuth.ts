/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User,
  signOut
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Configure Google OAuth Provider with required scopes
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
googleProvider.addScope('https://www.googleapis.com/auth/gmail.send');

// In-memory token cache
let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Initialize auth state and restore session
export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // If logged in but token is gone (e.g., page refresh), we may need to sign in again to get a fresh token.
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in with Google Popup
export const loginWithGoogle = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve Google OAuth access token.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Sign out
export const logoutFromGoogle = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

// Get current cached access token
export const getCachedAccessToken = (): string | null => {
  return cachedAccessToken;
};

// Set manual token (useful for restore or testing)
export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

// --- GMAIL API INTEGRATION ---

const buildSimpleHtmlMime = (to: string, subject: string, htmlBody: string) => {
  const emailLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    htmlBody,
  ];
  const email = emailLines.join('\r\n');
  
  // Base64url encode with browser btoa
  const base64 = btoa(unescape(encodeURIComponent(email)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const sendGmailNotification = async (
  accessToken: string,
  to: string,
  subject: string,
  htmlBody: string
) => {
  try {
    const raw = buildSimpleHtmlMime(to, subject, htmlBody);
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gmail Send Error (${response.status}): ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to send email via Gmail:', error);
    throw error;
  }
};

// --- GOOGLE SHEETS API INTEGRATION ---

export const createBackupSpreadsheet = async (accessToken: string): Promise<string> => {
  try {
    const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: 'Savour Festival - Shift Backup Database'
        },
        sheets: [
          {
            properties: {
              title: 'Shift Backups',
              gridProperties: {
                frozenRowCount: 1
              }
            }
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Spreadsheet Creation Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const spreadsheetId = data.spreadsheetId;

    // Seed the header row
    await seedSpreadsheetHeader(accessToken, spreadsheetId);

    return spreadsheetId;
  } catch (error) {
    console.error('Failed to create backup spreadsheet:', error);
    throw error;
  }
};

const seedSpreadsheetHeader = async (accessToken: string, spreadsheetId: string) => {
  const headers = [
    [
      'Backup Timestamp',
      'Log ID',
      'Shift ID',
      'Staff Name',
      'Staff Email',
      'Event Name',
      'Location',
      'Date',
      'Clock In Time',
      'Clock Out Time',
      'Total Shift Duration (hours)',
      'Total Unpaid Break (minutes)',
      'Breaks Count',
      'Feedback / Approval Notes',
      'Experience Rating (1-5)',
      'Improvement Feedback'
    ]
  ];

  await appendRowsToSpreadsheet(accessToken, spreadsheetId, 'Shift Backups!A1', headers);
};

export const appendRowsToSpreadsheet = async (
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: any[][]
) => {
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sheets Append Error (${response.status}): ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to append rows to spreadsheet:', error);
    throw error;
  }
};

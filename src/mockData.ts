/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FestivalEvent, StaffProfile, Shift, TimeLog } from './types';

export const INITIAL_EVENTS: FestivalEvent[] = [];

export const INITIAL_STAFF: StaffProfile[] = [
  {
    id: 'staff-admin',
    fullName: 'Dayne Savour',
    preferredName: 'Dayne',
    phoneNumber: '+44 7700 900077',
    email: 'dayne@savourfestival.com',
    pronouns: 'he/him',
    address: '123 Festival Way, London, SW3 4AX',
    financialDetails: {
      nameOnAccount: 'Dayne Savour Ltd',
      sortCode: '20-40-60',
      accountNumber: '98765432',
      bankName: 'Barclays Bank'
    },
    emergencyContact: {
      name: 'Sarah Savour',
      number: '+44 7700 900088',
      relationship: 'Spouse'
    },
    medicalConditions: 'None',
    seriousAllergies: 'None',
    codeOfConductSigned: true,
    codeOfConductSignedAt: '2026-07-01T10:00:00.000Z',
    codeOfConductSignature: 'Dayne Savour',
    role: 'admin',
    createdAt: '2026-07-01T10:00:00.000Z'
  }
];

export const INITIAL_SHIFTS: Shift[] = [];

export const INITIAL_TIMELOGS: TimeLog[] = [];

// LocalStorage helpers
export const loadData = <T>(key: string, defaultValue: T): T => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultValue;
  } catch (e) {
    console.error('Error loading key: ' + key, e);
    return defaultValue;
  }
};

export const saveData = <T>(key: string, data: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Error saving key: ' + key, e);
  }
};

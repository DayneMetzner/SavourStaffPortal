/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  getDoc,
  getDocs,
  where,
  orderBy
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { FestivalEvent, Shift, StaffProfile, TimeLog, Invitation, Invoice } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

// Global Firestore Error Handler conforming to the Skill requirement
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error Detailed Info:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- AUDIT LOGS ---

export async function writeAuditLog(action: string, targetId: string, details: string) {
  const path = 'auditLogs';
  try {
    const id = doc(collection(db, path)).id;
    await setDoc(doc(db, path, id), {
      id,
      action,
      actorUserId: auth.currentUser?.uid || 'anonymous',
      actorEmail: auth.currentUser?.email || 'anonymous@savourfestival.com',
      targetId,
      details,
      createdAt: new Date().toISOString()
    });
    console.log(`[Audit] logged action: ${action} on target: ${targetId}`);
  } catch (err) {
    // Audit logs should not crash the app, but let's log the error
    console.error('Audit Log writing failed:', err);
  }
}

// --- REALTIME SUBSCRIBERS ---

export function subscribeToEvents(onUpdate: (events: FestivalEvent[]) => void, onError: (err: Error) => void) {
  const path = 'events';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list: FestivalEvent[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as FestivalEvent);
      });
      onUpdate(list);
    },
    (error) => {
      onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeToShifts(onUpdate: (shifts: Shift[]) => void, onError: (err: Error) => void) {
  const path = 'shifts';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list: Shift[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as Shift);
      });
      onUpdate(list);
    },
    (error) => {
      onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeToStaffProfiles(onUpdate: (staff: StaffProfile[]) => void, onError: (err: Error) => void) {
  const path = 'users';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list: StaffProfile[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as StaffProfile);
      });
      onUpdate(list);
    },
    (error) => {
      onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeToTimeLogs(onUpdate: (logs: TimeLog[]) => void, onError: (err: Error) => void) {
  const path = 'timeLogs';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list: TimeLog[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as TimeLog);
      });
      onUpdate(list);
    },
    (error) => {
      onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeToInvitations(onUpdate: (invitations: Invitation[]) => void, onError: (err: Error) => void) {
  const path = 'invitations';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list: Invitation[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          email: data.email,
          invitedAt: data.invitedAt,
          status: data.status,
          // support extra fields if needed:
          id: docSnap.id,
          invitedBy: data.invitedBy,
          onboardingToken: data.onboardingToken,
          registeredAt: data.registeredAt
        } as any);
      });
      onUpdate(list);
    },
    (error) => {
      onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeToInvoices(onUpdate: (invoices: Invoice[]) => void, onError: (err: Error) => void) {
  const path = 'invoices';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list: Invoice[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as Invoice);
      });
      onUpdate(list);
    },
    (error) => {
      onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

// --- WRITE OPERATIONS ---

export async function createEventInFirestore(event: FestivalEvent) {
  const path = `events/${event.id}`;
  try {
    await setDoc(doc(db, 'events', event.id), event);
    await writeAuditLog('CREATE_EVENT', event.id, `Created event: ${event.name}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function createShiftInFirestore(shift: Shift) {
  const path = `shifts/${shift.id}`;
  try {
    await setDoc(doc(db, 'shifts', shift.id), shift);
    await writeAuditLog('CREATE_SHIFT', shift.id, `Created shift: ${shift.startTime}-${shift.endTime} at ${shift.locationName}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateShiftAllocationInFirestore(shiftId: string, allocatedStaffId: string | null, status: 'pending' | 'accepted' | 'denied') {
  const path = `shifts/${shiftId}`;
  try {
    await updateDoc(doc(db, 'shifts', shiftId), {
      allocatedStaffId,
      status
    });
    await writeAuditLog('ALLOCATE_SHIFT', shiftId, `Allocated staff ID: ${allocatedStaffId || 'NONE'} with status: ${status}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveStaffProfileToFirestore(profile: StaffProfile) {
  const path = `users/${profile.id}`;
  try {
    const dataToSave = {
      ...profile,
      updatedAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'users', profile.id), dataToSave, { merge: true });
    await writeAuditLog('SAVE_PROFILE', profile.id, `Saved staff profile: ${profile.fullName} (${profile.role})`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteStaffProfileFromFirestore(staffId: string) {
  const path = `users/${staffId}`;
  try {
    await deleteDoc(doc(db, 'users', staffId));
    await writeAuditLog('DELETE_STAFF', staffId, `Deleted staff profile: ${staffId}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updateStaffRoleInFirestore(staffId: string, role: 'admin' | 'staff') {
  const path = `users/${staffId}`;
  try {
    await updateDoc(doc(db, 'users', staffId), {
      role,
      updatedAt: new Date().toISOString()
    });
    await writeAuditLog('UPDATE_ROLE', staffId, `Updated staff ID: ${staffId} role to: ${role}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveTimeLogToFirestore(log: TimeLog) {
  const path = `timeLogs/${log.id}`;
  try {
    const dataToSave = {
      ...log,
      updatedAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'timeLogs', log.id), dataToSave, { merge: true });
    await writeAuditLog('SAVE_TIMELOG', log.id, `Saved time log for shift: ${log.shiftId}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function createInvitationInFirestore(invitation: { email: string; invitedAt: string; status: 'invited' | 'registered'; onboardingToken: string; invitedBy: string }) {
  // Use email as ID or sanitize to prevent illegal chars in path
  const safeId = invitation.email.replace(/[.#$/[\]]/g, '_');
  const path = `invitations/${safeId}`;
  try {
    await setDoc(doc(db, 'invitations', safeId), {
      ...invitation,
      id: safeId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    await writeAuditLog('CREATE_INVITATION', safeId, `Created invitation for: ${invitation.email}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function markInvitationRegisteredInFirestore(email: string) {
  const safeId = email.replace(/[.#$/[\]]/g, '_');
  const path = `invitations/${safeId}`;
  try {
    await updateDoc(doc(db, 'invitations', safeId), {
      status: 'registered',
      registeredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    await writeAuditLog('REGISTER_INVITATION', safeId, `Registered invitation for: ${email}`);
  } catch (error) {
    // If the invitation doesn't exist, ignore or log it
    console.warn(`Could not mark invitation registered for ${email}: ${error}`);
  }
}

export async function deleteInvitationFromFirestore(email: string) {
  const safeId = email.replace(/[.#$/[\]]/g, '_');
  const path = `invitations/${safeId}`;
  try {
    await deleteDoc(doc(db, 'invitations', safeId));
    await writeAuditLog('DELETE_INVITATION', safeId, `Deleted invitation for: ${email}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveInvoiceToFirestore(invoice: Invoice) {
  const path = `invoices/${invoice.id}`;
  try {
    const dataToSave = {
      ...invoice,
      updatedAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'invoices', invoice.id), dataToSave, { merge: true });
    await writeAuditLog('SAVE_INVOICE', invoice.id, `Saved invoice: ${invoice.id} for event: ${invoice.eventName}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateInvoiceStatusInFirestore(
  invoiceId: string, 
  status: 'pending' | 'approved' | 'not_approved' | 'paid', 
  details?: { approvedByAdminId?: string; approvedByAdminName?: string; rejectionReason?: string }
) {
  const path = `invoices/${invoiceId}`;
  try {
    const updates: any = {
      status,
      updatedAt: new Date().toISOString()
    };
    if (status === 'approved') {
      updates.approvedByAdminId = details?.approvedByAdminId || '';
      updates.approvedByAdminName = details?.approvedByAdminName || '';
      updates.approvedAt = new Date().toISOString();
    } else if (status === 'not_approved') {
      updates.rejectionReason = details?.rejectionReason || '';
      updates.rejectedAt = new Date().toISOString();
    } else if (status === 'paid') {
      updates.paidAt = new Date().toISOString();
    }
    await updateDoc(doc(db, 'invoices', invoiceId), updates);
    await writeAuditLog('UPDATE_INVOICE_STATUS', invoiceId, `Updated invoice status to: ${status}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteShiftFromFirestore(shiftId: string) {
  const path = `shifts/${shiftId}`;
  try {
    await deleteDoc(doc(db, 'shifts', shiftId));
    await writeAuditLog('DELETE_SHIFT', shiftId, `Deleted shift: ${shiftId}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updateShiftInFirestore(shift: Shift) {
  const path = `shifts/${shift.id}`;
  try {
    await setDoc(doc(db, 'shifts', shift.id), shift, { merge: true });
    await writeAuditLog('UPDATE_SHIFT', shift.id, `Updated shift details for: ${shift.id}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateEventInFirestore(event: FestivalEvent) {
  const path = `events/${event.id}`;
  try {
    await setDoc(doc(db, 'events', event.id), event, { merge: true });
    await writeAuditLog('UPDATE_EVENT', event.id, `Updated event: ${event.name}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getStaffProfilesFromFirestore(): Promise<StaffProfile[]> {
  const path = 'users';
  try {
    const snapshot = await getDocs(collection(db, path));
    const list: StaffProfile[] = [];
    snapshot.forEach((docSnap) => {
      list.push(docSnap.data() as StaffProfile);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function getInvitationsFromFirestore(): Promise<Invitation[]> {
  const path = 'invitations';
  try {
    const snapshot = await getDocs(collection(db, path));
    const list: Invitation[] = [];
    snapshot.forEach((docSnap) => {
      list.push(docSnap.data() as Invitation);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function getInvitationFromFirestore(email: string): Promise<Invitation | null> {
  const safeId = email.replace(/[.#$/[\]]/g, '_');
  const path = `invitations/${safeId}`;
  try {
    const docSnap = await getDoc(doc(db, 'invitations', safeId));
    if (docSnap.exists()) {
      return docSnap.data() as Invitation;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

export async function getStaffProfileFromFirestore(uid: string): Promise<StaffProfile | null> {
  const path = `users/${uid}`;
  try {
    const docSnap = await getDoc(doc(db, 'users', uid));
    if (docSnap.exists()) {
      return docSnap.data() as StaffProfile;
    }
    return null;
  } catch (error) {
    // If permission or document doesn't exist, return null gracefully instead of breaking
    return null;
  }
}




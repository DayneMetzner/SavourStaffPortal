/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  INITIAL_EVENTS, 
  INITIAL_STAFF, 
  INITIAL_SHIFTS, 
  INITIAL_TIMELOGS, 
  loadData, 
  saveData 
} from './mockData';
import { FestivalEvent, StaffProfile, Shift, TimeLog, Invitation, Invoice } from './types';
import { LoginScreen } from './components/LoginScreen';
import { AdminPanel } from './components/AdminPanel';
import { StaffPanel } from './components/StaffPanel';
import { OnboardingWizard } from './components/OnboardingWizard';
import { Shield, User, Users, ClipboardList, Info, Sparkles, Mail, Check, X, ShieldAlert, Heart, LogOut, CloudLightning } from 'lucide-react';
import { 
  initGoogleAuth, 
  loginWithGoogle, 
  logoutFromGoogle, 
  sendGmailNotification, 
  createBackupSpreadsheet, 
  appendRowsToSpreadsheet 
} from './utils/googleAuth';
import { 
  calculateBreakMinutes, 
  calculateWorkedHours 
} from './utils/shiftHelpers';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './utils/firebase';
import { 
  subscribeToEvents, 
  subscribeToShifts, 
  subscribeToStaffProfiles, 
  subscribeToTimeLogs, 
  subscribeToInvitations, 
  subscribeToInvoices,
  createEventInFirestore,
  createShiftInFirestore,
  updateShiftAllocationInFirestore,
  saveStaffProfileToFirestore,
  deleteStaffProfileFromFirestore,
  updateStaffRoleInFirestore,
  saveTimeLogToFirestore,
  createInvitationInFirestore,
  markInvitationRegisteredInFirestore,
  deleteInvitationFromFirestore,
  saveInvoiceToFirestore,
  updateInvoiceStatusInFirestore,
  updateEventInFirestore,
  updateShiftInFirestore,
  deleteShiftFromFirestore,
  getStaffProfilesFromFirestore
} from './utils/firestoreData';

export default function App() {
  // Load initial data from localStorage or default seeds (as a fallback before Firestore loads)
  const [events, setEvents] = useState<FestivalEvent[]>(() => 
    loadData<FestivalEvent[]>('fest_events', INITIAL_EVENTS)
  );
  
  const [shifts, setShifts] = useState<Shift[]>(() => 
    loadData<Shift[]>('fest_shifts', INITIAL_SHIFTS)
  );
  
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>(() => 
    loadData<StaffProfile[]>('fest_staff', INITIAL_STAFF)
  );
  
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>(() => 
    loadData<TimeLog[]>('fest_timelogs', INITIAL_TIMELOGS)
  );

  const [invitations, setInvitations] = useState<Invitation[]>(() => 
    loadData<Invitation[]>('fest_invitations', [])
  );

  const [invoices, setInvoices] = useState<Invoice[]>(() => 
    loadData<Invoice[]>('fest_invoices', [])
  );

  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [backupSpreadsheetId, setBackupSpreadsheetId] = useState<string | null>(() => {
    return localStorage.getItem('savour_backup_spreadsheet_id') || null;
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [sessionLoading, setSessionLoading] = useState<boolean>(true);
  const [isMigrating, setIsMigrating] = useState<boolean>(false);
  const [currentProfileId, setCurrentProfileId] = useState<string>('');
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);

  // 1. Session & Auth Listener
  useEffect(() => {
    // Check local admin passcode session
    const localSession = sessionStorage.getItem('savour_hq_session');
    if (localSession === 'admin') {
      setIsAuthenticated(true);
      const adminProfile = INITIAL_STAFF.find(p => p.role === 'admin');
      if (adminProfile) {
        setCurrentProfileId(adminProfile.id);
      }
      setSessionLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setGoogleUser(user);
        const email = user.email?.toLowerCase().trim();

        // Dynamically load the newest staff profiles from Firestore to prevent stale local whitelists
        let currentStaffList: StaffProfile[] = [];
        try {
          const live = await getStaffProfilesFromFirestore();
          if (live && live.length > 0) {
            const hasAdmin = live.some(p => p.role === 'admin' || p.email.toLowerCase() === 'dayne@savourfestival.com');
            const merged = hasAdmin ? live : [INITIAL_STAFF.find(p => p.role === 'admin') || INITIAL_STAFF[0], ...live];
            setStaffProfiles(merged);
            currentStaffList = merged;
          } else {
            setStaffProfiles(INITIAL_STAFF);
            currentStaffList = INITIAL_STAFF;
          }
        } catch (e) {
          console.error("Auth state change: could not query Firestore 'users' whitelists:", e);
          setStaffProfiles(INITIAL_STAFF);
          currentStaffList = INITIAL_STAFF;
        }

        if (email === 'dayne@savourfestival.com') {
          setIsAuthenticated(true);
          const adminProfile = currentStaffList.find(p => p.role === 'admin') || INITIAL_STAFF.find(p => p.role === 'admin');
          if (adminProfile) {
            setCurrentProfileId(adminProfile.id);
          }
        } else {
          // Check if registered staff member
          const matched = currentStaffList.find(p => p.email.toLowerCase().trim() === email);
          if (matched) {
            setIsAuthenticated(true);
            setCurrentProfileId(matched.id);
          } else {
            // Not registered staff member!
            setIsAuthenticated(false);
            setCurrentProfileId('');
          }
        }
      } else {
        setGoogleUser(null);
        // Only set authenticated false if there is no admin bypass session active
        if (sessionStorage.getItem('savour_hq_session') !== 'admin') {
          setIsAuthenticated(false);
          setCurrentProfileId('');
        }
      }
      setSessionLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Real-time Firestore synchronizer
  useEffect(() => {
    if (!isAuthenticated) return;

    // Check if we are running in passcode bypass mode (no Google authentication session in Firebase Auth)
    const isPasscodeMode = sessionStorage.getItem('savour_hq_session') === 'admin' && !googleUser;
    if (isPasscodeMode) {
      setDbConnected(false);
      setDbError("Coordinator Passcode Fallback mode: running securely in offline local sandbox.");
      return;
    }

    setDbConnected(null); // Set to loading/checking
    setDbError(null);

    const unsubEvents = subscribeToEvents(
      (data) => {
        setEvents(data);
        setDbConnected(true);
        setDbError(null);
      },
      (err) => {
        console.error('Events database sync warning:', err);
        setDbConnected(false);
        setDbError(err.message || String(err));
      }
    );

    const unsubShifts = subscribeToShifts(
      (data) => {
        setShifts(data);
        setDbConnected(true);
        setDbError(null);
      },
      (err) => {
        console.error('Shifts database sync warning:', err);
        setDbConnected(false);
        setDbError(err.message || String(err));
      }
    );

    const unsubProfiles = subscribeToStaffProfiles(
      (data) => {
        if (data.length > 0) {
          const hasAdmin = data.some(p => p.role === 'admin' || p.email.toLowerCase() === 'dayne@savourfestival.com');
          if (!hasAdmin) {
            const defaultAdmin = INITIAL_STAFF.find(p => p.role === 'admin') || INITIAL_STAFF[0];
            setStaffProfiles([defaultAdmin, ...data]);
          } else {
            setStaffProfiles(data);
          }
        } else {
          // Fallback to preserve the default Dayne admin if Firestore users table is completely empty
          setStaffProfiles(INITIAL_STAFF);
        }
        setDbConnected(true);
        setDbError(null);
      },
      (err) => {
        console.error('Staff database sync warning:', err);
        setDbConnected(false);
        setDbError(err.message || String(err));
      }
    );

    const unsubTimeLogs = subscribeToTimeLogs(
      (data) => {
        setTimeLogs(data);
        setDbConnected(true);
        setDbError(null);
      },
      (err) => {
        console.error('TimeLogs database sync warning:', err);
        setDbConnected(false);
        setDbError(err.message || String(err));
      }
    );

    const unsubInvitations = subscribeToInvitations(
      (data) => {
        setInvitations(data);
        setDbConnected(true);
        setDbError(null);
      },
      (err) => {
        console.error('Invitations database sync warning:', err);
        setDbConnected(false);
        setDbError(err.message || String(err));
      }
    );

    const unsubInvoices = subscribeToInvoices(
      (data) => {
        setInvoices(data);
        setDbConnected(true);
        setDbError(null);
      },
      (err) => {
        console.error('Invoices database sync warning:', err);
        setDbConnected(false);
        setDbError(err.message || String(err));
      }
    );

    return () => {
      unsubEvents();
      unsubShifts();
      unsubProfiles();
      unsubTimeLogs();
      unsubInvitations();
      unsubInvoices();
    };
  }, [isAuthenticated, googleUser]);

  const handleGoogleConnect = async () => {
    try {
      const result = await loginWithGoogle();
      if (result) {
        setGoogleUser(result.user);
        setGoogleToken(result.accessToken);
        
        // If we don't have a spreadsheet ID, automatically create one!
        if (!backupSpreadsheetId) {
          const newSheetId = await createBackupSpreadsheet(result.accessToken);
          setBackupSpreadsheetId(newSheetId);
          localStorage.setItem('savour_backup_spreadsheet_id', newSheetId);
          alert(`Successfully connected to Google Workspace!\n\nCreated new master backup spreadsheet:\n"Savour Festival - Shift Backup Database"`);
        } else {
          alert(`Successfully connected to Google Workspace!\nUsing existing backup spreadsheet.`);
        }
      }
    } catch (err: any) {
      console.error(err);
      alert('Google connection failed: ' + err.message);
    }
  };

  const handleGoogleDisconnect = async () => {
    try {
      await logoutFromGoogle();
      setGoogleUser(null);
      setGoogleToken(null);
      alert('Disconnected from Google Workspace.');
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleBackupAllShifts = async () => {
    if (!googleToken || !backupSpreadsheetId) {
      alert('Please connect Google Workspace first.');
      return;
    }
    
    // Find all completed logs
    const completedLogs = timeLogs.filter(l => l.clockOutTime);
    if (completedLogs.length === 0) {
      alert('No completed shifts found to back up.');
      return;
    }

    try {
      const rows = completedLogs.map(log => {
        const staff = staffProfiles.find(p => p.id === log.staffId);
        const shift = shifts.find(s => s.id === log.shiftId);
        const event = shift ? events.find(e => e.id === shift.eventId) : null;
        
        const workedHours = calculateWorkedHours(log.clockInTime, log.clockOutTime, log.breaks);
        const breakMinutes = calculateBreakMinutes(log.breaks);

        return [
          new Date().toISOString(),
          log.id,
          log.shiftId,
          staff?.fullName || 'N/A',
          staff?.email || 'N/A',
          event?.name || 'N/A',
          shift?.locationName || 'N/A',
          shift?.date || 'N/A',
          log.clockInTime || 'N/A',
          log.clockOutTime || 'N/A',
          workedHours,
          breakMinutes,
          log.breaks.length,
          log.feedbackApproval || 'N/A',
          log.feedbackRating || 0,
          log.feedbackImprovement || 'N/A'
        ];
      });

      await appendRowsToSpreadsheet(googleToken, backupSpreadsheetId, 'Shift Backups!A1', rows);
      alert(`Successfully backed up ${rows.length} completed shifts to Google Sheets!`);
    } catch (err: any) {
      console.error(err);
      alert('Backup failed: ' + err.message);
    }
  };

  const [latestSimulatedEmail, setLatestSimulatedEmail] = useState<{
    to: string;
    subject: string;
    body: string;
  } | null>(null);

  const [onboardingEmail, setOnboardingEmail] = useState<string | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('onboardEmail');
    } catch {
      return null;
    }
  });

  const currentProfile = staffProfiles.find((p) => p.id === currentProfileId);

  // 1. Create a brand new festival event
  const handleCreateEvent = async (newEventData: Omit<FestivalEvent, 'id'>) => {
    const newEvent: FestivalEvent = {
      ...newEventData,
      id: `evt-${Date.now()}`
    };
    setEvents((prevEvents) => {
      const existingIds = new Set(prevEvents.map(e => e.id));
      if (existingIds.has(newEvent.id)) return prevEvents;
      const updated = [...prevEvents, newEvent];
      saveData('fest_events', updated);
      return updated;
    });
    await createEventInFirestore(newEvent);
  };

  // 1b. Update an existing festival event (dates, locations, etc.)
  const handleUpdateEvent = async (updatedEvent: FestivalEvent) => {
    const updated = events.map(e => e.id === updatedEvent.id ? updatedEvent : e);
    setEvents(updated);
    saveData('fest_events', updated);
    await updateEventInFirestore(updatedEvent);
  };

  // 2. Create a blank shift for an event
  const handleCreateShift = async (newShiftData: Omit<Shift, 'id'>, count: number = 1) => {
    const newShifts: Shift[] = [];
    const now = Date.now();
    for (let i = 0; i < count; i++) {
      const newShift = {
        ...newShiftData,
        id: `shift-${now}-${i}-${Math.random().toString(36).substr(2, 5)}`
      };
      newShifts.push(newShift);
      await createShiftInFirestore(newShift);
    }
    setShifts((prevShifts) => {
      const existingIds = new Set(prevShifts.map(s => s.id));
      const filteredNew = newShifts.filter(s => !existingIds.has(s.id));
      if (filteredNew.length === 0) return prevShifts;
      const updated = [...prevShifts, ...filteredNew];
      saveData('fest_shifts', updated);
      return updated;
    });
  };

  // 2b. Update an existing shift's details (dates, times, rate, etc.)
  const handleUpdateShift = async (updatedShift: Shift) => {
    const updated = shifts.map(s => s.id === updatedShift.id ? updatedShift : s);
    setShifts(updated);
    saveData('fest_shifts', updated);
    await updateShiftInFirestore(updatedShift);
  };

  // 2c. Delete a shift
  const handleDeleteShift = async (shiftId: string) => {
    const updated = shifts.filter(s => s.id !== shiftId);
    setShifts(updated);
    saveData('fest_shifts', updated);
    await deleteShiftFromFirestore(shiftId);
  };

  // 3. Allocate/reallocate staff to a shift
  const handleAllocateStaff = async (shiftId: string, staffId: string | null) => {
    const updated = shifts.map((s) => {
      if (s.id === shiftId) {
        return {
          ...s,
          allocatedStaffId: staffId,
          status: 'pending' as const
        };
      }
      return s;
    });
    setShifts(updated);
    saveData('fest_shifts', updated);
    await updateShiftAllocationInFirestore(shiftId, staffId, 'pending');
  };

  // 4. Update staff profile details
  const handleUpdateProfile = async (updatedProfile: StaffProfile) => {
    const updated = staffProfiles.map((p) => 
      p.id === updatedProfile.id ? updatedProfile : p
    );
    setStaffProfiles(updated);
    saveData('fest_staff', updated);
    await saveStaffProfileToFirestore(updatedProfile);
  };

  // 5. Staff register/signup
  const handleRegisterStaff = async (newStaffData: Omit<StaffProfile, 'id' | 'createdAt'>) => {
    const newId = `staff-${Date.now()}`;
    const newStaff: StaffProfile = {
      ...newStaffData,
      id: newId,
      createdAt: new Date().toISOString()
    };
    const updated = [...staffProfiles, newStaff];
    setStaffProfiles(updated);
    saveData('fest_staff', updated);
    setCurrentProfileId(newId);
    await saveStaffProfileToFirestore(newStaff);
  };

  // 6. Staff responds to shift allocation (accept / deny)
  const handleRespondToShift = async (shiftId: string, responseStatus: 'accepted' | 'denied') => {
    const updated = shifts.map((s) => {
      if (s.id === shiftId && s.allocatedStaffId === currentProfileId) {
        return {
          ...s,
          status: responseStatus
        };
      }
      return s;
    });
    setShifts(updated);
    saveData('fest_shifts', updated);
    await updateShiftAllocationInFirestore(shiftId, currentProfileId, responseStatus);
  };

  // 7. Timeclock: Clock-In
  const handleClockIn = async (shiftId: string, initialLocationName: string) => {
    const newLog: TimeLog = {
      id: `log-${Date.now()}`,
      shiftId,
      staffId: currentProfileId,
      clockInTime: new Date().toISOString(),
      clockOutTime: null,
      breaks: [],
      locationLogs: [
        {
          locationName: initialLocationName,
          timestamp: new Date().toISOString()
        }
      ]
    };
    const updated = [...timeLogs, newLog];
    setTimeLogs(updated);
    saveData('fest_timelogs', updated);
    await saveTimeLogToFirestore(newLog);
  };

  // 8. Timeclock: Start Unpaid Break
  const handleStartBreak = async (shiftId: string) => {
    let updatedLog: TimeLog | null = null;
    const updated = timeLogs.map((log) => {
      if (log.shiftId === shiftId && log.staffId === currentProfileId && !log.clockOutTime) {
        updatedLog = {
          ...log,
          breaks: [
            ...log.breaks,
            {
              start: new Date().toISOString(),
              end: null
            }
          ]
        };
        return updatedLog;
      }
      return log;
    });
    if (updatedLog) {
      setTimeLogs(updated);
      saveData('fest_timelogs', updated);
      await saveTimeLogToFirestore(updatedLog);
    }
  };

  // 9. Timeclock: End Unpaid Break
  const handleEndBreak = async (shiftId: string) => {
    let updatedLog: TimeLog | null = null;
    const updated = timeLogs.map((log) => {
      if (log.shiftId === shiftId && log.staffId === currentProfileId && !log.clockOutTime) {
        updatedLog = {
          ...log,
          breaks: log.breaks.map((b) => {
            if (!b.end) {
              return { ...b, end: new Date().toISOString() };
            }
            return b;
          })
        };
        return updatedLog;
      }
      return log;
    });
    if (updatedLog) {
      setTimeLogs(updated);
      saveData('fest_timelogs', updated);
      await saveTimeLogToFirestore(updatedLog);
    }
  };

  // 10. Timeclock: Clock-Out
  const handleClockOut = async (
    shiftId: string,
    feedback?: { approval: string; rating: number; improvement: string }
  ) => {
    const targetLog = timeLogs.find(
      (log) => log.shiftId === shiftId && log.staffId === currentProfileId && !log.clockOutTime
    );
    if (!targetLog) return;

    const closedBreaks = targetLog.breaks.map((b) => {
      if (!b.end) {
        return { ...b, end: new Date().toISOString() };
      }
      return b;
    });

    const clockOutTime = new Date().toISOString();
    const completedLog: TimeLog = {
      ...targetLog,
      breaks: closedBreaks,
      clockOutTime,
      feedbackApproval: feedback?.approval,
      feedbackRating: feedback?.rating,
      feedbackImprovement: feedback?.improvement
    };

    const updated = timeLogs.map((log) => log.id === targetLog.id ? completedLog : log);
    setTimeLogs(updated);
    saveData('fest_timelogs', updated);
    await saveTimeLogToFirestore(completedLog);

    // Get shift, staff, and event details for notification & sheets backup
    const staff = staffProfiles.find((p) => p.id === currentProfileId);
    const shift = shifts.find((s) => s.id === shiftId);
    const event = shift ? events.find((e) => e.id === shift.eventId) : null;

    if (staff && shift && event) {
      const workedHours = calculateWorkedHours(completedLog.clockInTime, completedLog.clockOutTime, completedLog.breaks);
      const breakMinutes = calculateBreakMinutes(completedLog.breaks);
      
      const staffName = staff.fullName || 'Staff';
      const eventName = event.name || 'Festival Event';
      const locationName = shift.locationName || 'Main Venue';
      const dateStr = shift.date || new Date().toISOString().split('T')[0];
      const clockInStr = completedLog.clockInTime 
        ? new Date(completedLog.clockInTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) 
        : 'N/A';
      const clockOutStr = completedLog.clockOutTime 
        ? new Date(completedLog.clockOutTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) 
        : 'N/A';

      // Build Breaks List HTML
      let breaksHtml = '<ul style="margin: 0; padding-left: 20px;">';
      if (completedLog.breaks.length === 0) {
        breaksHtml += '<li>No unpaid breaks were taken.</li>';
      } else {
        completedLog.breaks.forEach((b, index) => {
          const bStart = new Date(b.start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
          const bEnd = b.end ? new Date(b.end).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'N/A';
          const bDuration = b.end ? `${Math.round((new Date(b.end).getTime() - new Date(b.start).getTime()) / 60000)}m` : 'N/A';
          breaksHtml += `<li style="margin-bottom: 4px;"><strong>Break #${index + 1}:</strong> ${bStart} - ${bEnd} (${bDuration})</li>`;
        });
      }
      breaksHtml += '</ul>';

      // Build Feedback HTML
      let feedbackHtml = '';
      if (feedback) {
        feedbackHtml = `
          <h4 style="margin: 16px 0 8px 0; font-size: 13px; color: #2d3748; text-transform: uppercase; letter-spacing: 0.5px;">Your Submitted Feedback</h4>
          <div style="font-size: 13px; color: #4a5568; background-color: #f7fafc; padding: 12px; border-radius: 6px; border: 1px solid #edf2f7; margin-bottom: 24px; line-height: 1.5;">
            <div><strong>Start/Finish/Break Approvals:</strong> ${feedback.approval}</div>
            <div style="margin-top: 6px;"><strong>Shift Rating:</strong> ${'★'.repeat(feedback.rating)}${'☆'.repeat(5 - feedback.rating)} (${feedback.rating}/5 stars)</div>
            ${feedback.improvement ? `<div style="margin-top: 6px;"><strong>Suggestions:</strong> ${feedback.improvement}</div>` : ''}
          </div>
        `;
      }

      const emailSubject = `🎪 Shift Completion Confirmation: ${eventName} - ${dateStr}`;
      
      const plainTextBody = `Hi ${staffName},\n\nYou have successfully completed and submitted your shift for ${eventName} on ${dateStr}.\n\n--- SHIFT DETAILS ---\nLocation: ${locationName}\nClock-In: ${clockInStr}\nClock-Out: ${clockOutStr}\nTotal Breaks: ${breakMinutes} minutes\nTotal Worked Hours: ${workedHours} hours\n\n${feedback ? `--- FEEDBACK ---\nApproval Notes: ${feedback.approval}\nRating: ${feedback.rating}/5\nSuggestions: ${feedback.improvement || 'None'}\n` : ''}\nThank you for your hard work!\nBest regards,\nSavour Festival Operations Team`;

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
          <div style="background-color: #4f46e5; padding: 24px; text-align: center; color: white;">
            <h2 style="margin: 0; font-size: 22px; font-weight: bold; letter-spacing: -0.5px;">🎪 Savour Food Festival</h2>
            <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;">Shift Completion Confirmation</p>
          </div>
          <div style="padding: 24px; background-color: #ffffff;">
            <p style="font-size: 15px; line-height: 1.5; margin-top: 0;">Hi <strong>${staffName}</strong>,</p>
            <p style="font-size: 14px; line-height: 1.5; color: #4a5568;">Great job! You have successfully clocked out and completed your shift for <strong>${eventName}</strong>. Below is a detailed confirmation of your timesheet for your records.</p>
            
            <div style="margin: 24px 0; background-color: #f7fafc; border-left: 4px solid #4f46e5; padding: 16px; border-radius: 0 8px 8px 0;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <tr>
                  <td style="padding: 6px 0; color: #718096; font-weight: bold; width: 40%;">Location/Zone:</td>
                  <td style="padding: 6px 0; color: #1a202c; font-weight: bold;">${locationName}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #718096; font-weight: bold;">Date:</td>
                  <td style="padding: 6px 0; color: #1a202c;">${dateStr}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #718096; font-weight: bold;">Clock-In Time:</td>
                  <td style="padding: 6px 0; color: #1a202c;">${clockInStr}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #718096; font-weight: bold;">Clock-Out Time:</td>
                  <td style="padding: 6px 0; color: #1a202c;">${clockOutStr}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #718096; font-weight: bold;">Total Break Time:</td>
                  <td style="padding: 6px 0; color: #1a202c;">${breakMinutes} minutes</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #718096; font-weight: bold; font-size: 14px;">Total Worked Hours:</td>
                  <td style="padding: 6px 0; color: #4f46e5; font-weight: bold; font-size: 14px;">${workedHours} hours</td>
                </tr>
              </table>
            </div>

            <h4 style="margin: 16px 0 8px 0; font-size: 13px; color: #2d3748; text-transform: uppercase; letter-spacing: 0.5px;">Breaks Breakdown</h4>
            <div style="font-size: 13px; color: #4a5568; background-color: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #edf2f7; margin-bottom: 24px;">
              ${breaksHtml}
            </div>

            ${feedbackHtml}

            <p style="font-size: 13px; color: #718096; margin-bottom: 0; line-height: 1.5;">This email serves as an official confirmation of your shift. It has been automatically backed up and logged for coordinator approval and invoice validation. You can generate and submit your invoice for this shift under the <strong>Invoices & Expenses</strong> tab in the portal.</p>
          </div>
          <div style="background-color: #f7fafc; padding: 16px; text-align: center; border-top: 1px solid #edf2f7; font-size: 11px; color: #a0aec0;">
            &copy; 2026 Savour Food Festival HQ. All rights reserved.
          </div>
        </div>
      `;

      // Trigger simulation popup
      setLatestSimulatedEmail({
        to: staff.email || 'staff@savourfestival.com',
        subject: emailSubject,
        body: plainTextBody
      });

      // If Google token exists, send real email via Gmail API
      if (googleToken && staff.email) {
        sendGmailNotification(googleToken, staff.email, emailSubject, htmlContent)
          .then(() => console.log('Successfully sent actual Gmail confirmation to', staff.email))
          .catch((err) => console.error('Gmail send failed:', err));
      }

      // If Google token exists and we have a spreadsheet, backup to Google Sheets
      if (googleToken && backupSpreadsheetId) {
        const row = [
          [
            new Date().toISOString(),
            completedLog.id,
            completedLog.shiftId,
            staffName,
            staff.email || 'N/A',
            eventName,
            locationName,
            dateStr,
            completedLog.clockInTime || 'N/A',
            completedLog.clockOutTime || 'N/A',
            workedHours,
            breakMinutes,
            completedLog.breaks.length,
            completedLog.feedbackApproval || 'N/A',
            completedLog.feedbackRating || 0,
            completedLog.feedbackImprovement || 'N/A'
          ]
        ];
        appendRowsToSpreadsheet(googleToken, backupSpreadsheetId, 'Shift Backups!A1', row)
          .then(() => console.log('Successfully backed up shift to Google Sheets!'))
          .catch((err) => console.error('Google Sheets backup failed:', err));
      }
    }
  };

  // 11. Timeclock: Log Mid-Shift Location Transfer
  const handleMoveLocation = async (shiftId: string, newLocation: string) => {
    let updatedLog: TimeLog | null = null;
    const updated = timeLogs.map((log) => {
      if (log.shiftId === shiftId && log.staffId === currentProfileId && !log.clockOutTime) {
        updatedLog = {
          ...log,
          locationLogs: [
            ...log.locationLogs,
            {
              locationName: newLocation,
              timestamp: new Date().toISOString()
            }
          ]
        };
        return updatedLog;
      }
      return log;
    });
    if (updatedLog) {
      setTimeLogs(updated);
      saveData('fest_timelogs', updated);
      await saveTimeLogToFirestore(updatedLog);
    }
  };

  // 12. Admin edits or manually creates timesheets
  const handleUpdateTimeLog = async (updatedLog: TimeLog) => {
    setTimeLogs((prevLogs) => {
      const exists = prevLogs.some((log) => log.id === updatedLog.id);
      const updated = exists
        ? prevLogs.map((log) => (log.id === updatedLog.id ? updatedLog : log))
        : [...prevLogs, updatedLog];
      saveData('fest_timelogs', updated);
      return updated;
    });
    await saveTimeLogToFirestore(updatedLog);
  };

  // 13. Delete a staff profile and all associated allocations
  const handleDeleteStaff = async (staffId: string) => {
    if (window.confirm('Are you sure you want to permanently delete this staff member? This will clear all their shift allocations and time records.')) {
      const updatedProfiles = staffProfiles.filter((p) => p.id !== staffId);
      setStaffProfiles(updatedProfiles);
      saveData('fest_staff', updatedProfiles);

      const updatedShifts = shifts.map((s) => {
        if (s.allocatedStaffId === staffId) {
          return { ...s, allocatedStaffId: null, status: 'pending' as const };
        }
        return s;
      });
      setShifts(updatedShifts);
      saveData('fest_shifts', updatedShifts);

      const updatedLogs = timeLogs.filter((log) => log.staffId !== staffId);
      setTimeLogs(updatedLogs);
      saveData('fest_timelogs', updatedLogs);

      if (currentProfileId === staffId) {
        const admin = updatedProfiles.find(p => p.role === 'admin');
        setCurrentProfileId(admin ? admin.id : updatedProfiles[0]?.id || '');
      }

      await deleteStaffProfileFromFirestore(staffId);
      for (const sh of shifts) {
        if (sh.allocatedStaffId === staffId) {
          await updateShiftAllocationInFirestore(sh.id, null, 'pending');
        }
      }
    }
  };

  // 14. Update staff role (promote/demote admin rights)
  const handleUpdateStaffRole = async (staffId: string, role: 'staff' | 'admin') => {
    const updated = staffProfiles.map((p) => {
      if (p.id === staffId) {
        return { ...p, role };
      }
      return p;
    });
    setStaffProfiles(updated);
    saveData('fest_staff', updated);
    await updateStaffRoleInFirestore(staffId, role);
  };

  // 15. Invite staff member by email
  const handleInviteStaff = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;

    if (staffProfiles.some((p) => p.email.toLowerCase() === cleanEmail)) {
      alert(`Staff member with email "${cleanEmail}" is already registered.`);
      return;
    }

    if (invitations.some((i) => i.email.toLowerCase() === cleanEmail)) {
      alert(`An invitation has already been sent to "${cleanEmail}".`);
      return;
    }

    const onboardingToken = Math.random().toString(36).substring(2, 10);
    const newInv: Invitation = {
      email: cleanEmail,
      invitedAt: new Date().toISOString(),
      status: 'invited'
    };

    const updated = [...invitations, newInv];
    setInvitations(updated);
    saveData('fest_invitations', updated);

    // Calculate current URL for testing convenience
    const currentURL = window.location.origin + window.location.pathname;

    setLatestSimulatedEmail({
      to: cleanEmail,
      subject: '🎪 Join Savour Food Festival Staff Team - Onboarding Link',
      body: `Hi there!\n\nYou have been invited to register as a staff member on the Savour Food Festival Portal.\n\nPlease click the link below to set up your billing details, emergency contact, medical declarations, and sign the official Code of Conduct:\n\n${currentURL}?onboardEmail=${encodeURIComponent(cleanEmail)}\n\nBest regards,\nSavour Festival Operations Team`
    });

    await createInvitationInFirestore({
      email: cleanEmail,
      invitedAt: newInv.invitedAt,
      status: 'invited',
      onboardingToken,
      invitedBy: 'dayne@savourfestival.com'
    });
  };

  const handleDeleteInvitation = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!window.confirm(`Are you sure you want to cancel and delete the invitation for ${cleanEmail}?`)) {
      return;
    }
    const updated = invitations.filter(i => i.email.toLowerCase() !== cleanEmail);
    setInvitations(updated);
    saveData('fest_invitations', updated);
    await deleteInvitationFromFirestore(cleanEmail);
  };

  const handleResendInvitation = (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const inv = invitations.find(i => i.email.toLowerCase() === cleanEmail);
    if (!inv) {
      alert(`Could not find an invitation for "${cleanEmail}".`);
      return;
    }
    const currentURL = window.location.origin + window.location.pathname;
    setLatestSimulatedEmail({
      to: cleanEmail,
      subject: '🎪 Join Savour Food Festival Staff Team - Onboarding Link',
      body: `Hi there!\n\nYou have been invited to register as a staff member on the Savour Food Festival Portal.\n\nPlease click the link below to set up your billing details, emergency contact, medical declarations, and sign the official Code of Conduct:\n\n${currentURL}?onboardEmail=${encodeURIComponent(cleanEmail)}\n\nBest regards,\nSavour Festival Operations Team`
    });
  };

  // 16. Onboarding Completion
  const handleOnboardComplete = async (profileData: StaffProfile) => {
    const updatedProfiles = [...staffProfiles, profileData];
    setStaffProfiles(updatedProfiles);
    saveData('fest_staff', updatedProfiles);

    const updatedInvs = invitations.map((i) => {
      if (i.email.toLowerCase() === profileData.email.toLowerCase()) {
        return { ...i, status: 'registered' as const };
      }
      return i;
    });
    setInvitations(updatedInvs);
    saveData('fest_invitations', updatedInvs);

    // Clear query param & onboarding state
    setOnboardingEmail(null);
    try {
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (e) {
      console.warn("Could not clear query parameter in iframe", e);
    }

    // Swapping to newly registered staff member's view
    setCurrentProfileId(profileData.id);

    await saveStaffProfileToFirestore(profileData);
    await markInvitationRegisteredInFirestore(profileData.email);
  };

  // Invoices Mutators
  const handleSubmitInvoice = async (invoice: Invoice) => {
    const updated = [...invoices.filter(i => i.id !== invoice.id), invoice];
    setInvoices(updated);
    saveData('fest_invoices', updated);
    await saveInvoiceToFirestore(invoice);
  };

  const handleApproveInvoice = async (invoiceId: string, adminId: string, adminName: string) => {
    const updated = invoices.map(inv => {
      if (inv.id === invoiceId) {
        return {
          ...inv,
          status: 'approved' as const,
          approvedByAdminId: adminId,
          approvedByAdminName: adminName,
          approvedAt: new Date().toISOString()
        };
      }
      return inv;
    });
    setInvoices(updated);
    saveData('fest_invoices', updated);
    await updateInvoiceStatusInFirestore(invoiceId, 'approved', { approvedByAdminId: adminId, approvedByAdminName: adminName });
  };

  const handleMarkInvoiceAsPaid = async (invoiceId: string) => {
    const updated = invoices.map(inv => {
      if (inv.id === invoiceId) {
        return {
          ...inv,
          status: 'paid' as const,
          paidAt: new Date().toISOString()
        };
      }
      return inv;
    });
    setInvoices(updated);
    saveData('fest_invoices', updated);
    await updateInvoiceStatusInFirestore(invoiceId, 'paid');
  };

  const handleRejectInvoice = async (invoiceId: string, reason: string) => {
    const invoiceToReject = invoices.find(i => i.id === invoiceId);
    if (!invoiceToReject) return;

    // Send simulated email
    setLatestSimulatedEmail({
      to: invoiceToReject.contactDetails.email,
      subject: `❌ Invoice NOT Approved: ${invoiceToReject.eventName}`,
      body: `Hi ${invoiceToReject.contactDetails.fullName || 'Staff'},\n\nYour invoice for the event "${invoiceToReject.eventName}" has been reviewed and was NOT approved for the following reason:\n\n"${reason}"\n\nPlease log in to the portal, update your invoice details, and resubmit.\n\nBest regards,\nFestival Coordinator HQ`
    });

    const updated = invoices.filter(inv => inv.id !== invoiceId);
    setInvoices(updated);
    saveData('fest_invoices', updated);
    await updateInvoiceStatusInFirestore(invoiceId, 'not_approved', { rejectionReason: reason });
  };

  // Data Migration Utility
  const handleMigrateToFirestore = async () => {
    if (window.confirm('Do you want to upload all current local/mock data to Google Cloud Firestore? This will seed your Firestore database with the complete initial Savour Festival datasets.')) {
      setIsMigrating(true);
      try {
        // 1. Migrate Events
        for (const evt of events) {
          await createEventInFirestore(evt);
        }
        // 2. Migrate Staff Profiles
        for (const st of staffProfiles) {
          await saveStaffProfileToFirestore(st);
        }
        // 3. Migrate Shifts
        for (const sh of shifts) {
          await createShiftInFirestore(sh);
        }
        // 4. Migrate TimeLogs
        for (const tl of timeLogs) {
          await saveTimeLogToFirestore(tl);
        }
        // 5. Migrate Invoices
        for (const inv of invoices) {
          await saveInvoiceToFirestore(inv);
        }
        // 6. Migrate Invitations
        for (const invite of invitations) {
          await createInvitationInFirestore({
            email: invite.email,
            invitedAt: invite.invitedAt,
            status: invite.status,
            onboardingToken: Math.random().toString(36).substring(2, 10),
            invitedBy: 'dayne@savourfestival.com'
          });
        }
        alert('All local/localStorage data has been successfully migrated to Firestore cloud storage!');
      } catch (err: any) {
        console.error('Migration failed:', err);
        alert('Data migration failed: ' + err.message);
      } finally {
        setIsMigrating(false);
      }
    }
  };

  const handleLoginSuccess = (email: string, role: 'admin' | 'staff', googleTokenString?: string | null) => {
    if (role === 'admin' && !googleTokenString) {
      sessionStorage.setItem('savour_hq_session', 'admin');
    }
    setIsAuthenticated(true);
    
    // Find matched profile
    const matched = staffProfiles.find(p => p.email.toLowerCase().trim() === email.toLowerCase().trim());
    if (matched) {
      setCurrentProfileId(matched.id);
    } else if (email === 'dayne@savourfestival.com') {
      const adminProfile = staffProfiles.find(p => p.role === 'admin') || INITIAL_STAFF.find(p => p.role === 'admin');
      if (adminProfile) {
        setCurrentProfileId(adminProfile.id);
      }
    }
  };

  const handleLogout = async () => {
    try {
      sessionStorage.removeItem('savour_hq_session');
      await logoutFromGoogle();
      setIsAuthenticated(false);
      setCurrentProfileId('');
    } catch (err) {
      console.error(err);
    }
  };

  // Reset demo utility
  const handleResetDemoData = () => {
    if (window.confirm('Are you sure you want to reset all data back to the default seed values?')) {
      localStorage.removeItem('fest_events');
      localStorage.removeItem('fest_shifts');
      localStorage.removeItem('fest_staff');
      localStorage.removeItem('fest_timelogs');
      localStorage.removeItem('fest_invoices');
      setEvents(INITIAL_EVENTS);
      setShifts(INITIAL_SHIFTS);
      setStaffProfiles(INITIAL_STAFF);
      setTimeLogs(INITIAL_TIMELOGS);
      setInvoices([]);
      const admin = INITIAL_STAFF.find(p => p.role === 'admin');
      setCurrentProfileId(admin ? admin.id : INITIAL_STAFF[0]?.id || '');
    }
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-100 font-sans p-4">
        <div className="flex flex-col items-center gap-4">
          <CloudLightning size={44} className="text-indigo-500 animate-pulse" />
          <p className="text-sm font-semibold tracking-wider uppercase text-slate-400">Connecting to Cloud Services...</p>
        </div>
      </div>
    );
  }

  if (onboardingEmail) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-between font-sans text-slate-100 p-4 md:p-8" id="onboarding-portal">
        <div className="max-w-3xl w-full mx-auto space-y-8 my-auto py-8">
          {/* Logo / Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex h-16 w-16 bg-slate-800 text-white rounded-3xl items-center justify-center font-extrabold text-3xl shadow-xl border border-slate-700">
              🎪
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              Savour Festival Staff Onboarding
            </h1>
            <p className="text-sm text-slate-400 max-w-lg mx-auto">
              Welcome! Please complete your official staff profile details, payment banking details, emergency contacts, and sign the Code of Conduct to activate your account.
            </p>
          </div>

          <OnboardingWizard 
            email={onboardingEmail} 
            onComplete={handleOnboardComplete} 
            onCancel={() => {
              setOnboardingEmail(null);
              try {
                window.history.replaceState({}, document.title, window.location.pathname);
              } catch {}
            }} 
          />
        </div>

        <footer className="py-4 text-center text-xs text-slate-500 font-medium">
          <p>© 2026 Savour Food Festival. Securely hosted onboarding gateway.</p>
        </footer>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} staffProfiles={staffProfiles} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans" id="app-root">
      
      {/* Main Brand Header */}
      <header className="bg-white border-b border-slate-200 py-4 px-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-extrabold text-lg shadow-sm shadow-slate-900/15">
            🎪
          </div>
          <div className="text-center sm:text-left">
            <h1 className="text-lg font-extrabold text-slate-950 tracking-tight flex items-center gap-1.5 justify-center sm:justify-start">
              Savour Staff Portal
              <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 text-[9px] font-bold rounded-md uppercase tracking-wider">
                Platform
              </span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">Onboarding & shift-coordination engine</p>
          </div>
        </div>

        {/* Status indicator / Switch panel */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 text-xs text-slate-500 font-medium mr-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1" />
            <span>Operational Mode:</span>
            {currentProfile?.role === 'admin' ? (
              <span className="ml-1.5 px-2 py-0.5 bg-slate-900 text-white text-[10px] font-bold rounded flex items-center gap-1">
                <Shield size={10} /> Coordinator HQ
              </span>
            ) : (
              <span className="ml-1.5 px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded flex items-center gap-1">
                <User size={10} /> Staff Dashboard
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 text-xs text-slate-500 font-medium mr-2">
            <span>Database:</span>
            {dbConnected === null ? (
              <span className="ml-1.5 px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded flex items-center gap-1" title="Establishing cloud connection to Firestore...">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" /> Connecting...
              </span>
            ) : dbConnected ? (
              <span className="ml-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded flex items-center gap-1" title="Real-time Google Firestore Database is connected & active!">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Cloud Active
              </span>
            ) : (
              <span 
                className="ml-1.5 px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded flex items-center gap-1" 
                title={
                  sessionStorage.getItem('savour_hq_session') === 'admin' && !googleUser
                    ? "Coordinator Passcode Fallback mode: Running securely in offline local sandbox. To connect to Cloud Firestore, sign out and use 'Sign In with Google'."
                    : dbError
                      ? `Unable to connect: ${dbError}. Click 'Sign In with Google' to authenticate correctly, or ensure Firestore is initialized in the savourstaffportal project.`
                      : "Unable to connect to Google Firestore. Falling back to local/localStorage sandbox."
                }
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Offline / Local
              </span>
            )}
          </div>

          <button
            onClick={handleLogout}
            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
            title="Log out of Savour Food Festival staff session"
          >
            <LogOut size={14} />
            Log Out
          </button>
        </div>
      </header>

      {/* Primary Workspace Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        
        {/* Router View based on selected role */}
        {currentProfile?.role === 'admin' ? (
          <AdminPanel
            events={events}
            shifts={shifts}
            staffProfiles={staffProfiles}
            timeLogs={timeLogs}
            invitations={invitations}
            invoices={invoices}
            onCreateEvent={handleCreateEvent}
            onUpdateEvent={handleUpdateEvent}
            onCreateShift={handleCreateShift}
            onUpdateShift={handleUpdateShift}
            onDeleteShift={handleDeleteShift}
            onAllocateStaff={handleAllocateStaff}
            onUpdateTimeLog={handleUpdateTimeLog}
            onDeleteStaff={handleDeleteStaff}
            onUpdateStaffRole={handleUpdateStaffRole}
            onInviteStaffEmail={handleInviteStaff}
            onDeleteInvitation={handleDeleteInvitation}
            onResendInvitation={handleResendInvitation}
            onApproveInvoice={handleApproveInvoice}
            onMarkInvoiceAsPaid={handleMarkInvoiceAsPaid}
            onRejectInvoice={handleRejectInvoice}
            currentAdminProfile={currentProfile}
            googleUser={googleUser}
            googleToken={googleToken}
            backupSpreadsheetId={backupSpreadsheetId}
            onGoogleConnect={handleGoogleConnect}
            onGoogleDisconnect={handleGoogleDisconnect}
            onBackupAllShifts={handleBackupAllShifts}
          />
        ) : currentProfile ? (
          <StaffPanel
            profile={currentProfile}
            events={events}
            shifts={shifts}
            timeLogs={timeLogs}
            invoices={invoices}
            onUpdateProfile={handleUpdateProfile}
            onRespondToShift={handleRespondToShift}
            onClockIn={handleClockIn}
            onClockOut={handleClockOut}
            onStartBreak={handleStartBreak}
            onEndBreak={handleEndBreak}
            onMoveLocation={handleMoveLocation}
            onSubmitInvoice={handleSubmitInvoice}
          />
        ) : (
          <div className="text-center py-20 bg-white border border-slate-100 rounded-2xl space-y-3">
            <Info className="mx-auto text-slate-300 animate-bounce" size={40} />
            <h3 className="font-bold text-slate-900 text-lg">No Active Profile Selected</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Please check with the coordinator or register your staff profile details via the email onboarding link first.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200/80 py-4 px-6 mt-12 text-center text-xs text-slate-400 font-medium">
        <p>© 2026 Savour Food Festival. All staff activities logged on UTC timezone. Securely audited platform.</p>
      </footer>

      {/* Simulated Email Pop-up Overlay */}
      {latestSimulatedEmail && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="simulated-email-modal">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl text-slate-200">
            {/* Header */}
            <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-indigo-600/20 text-indigo-400 rounded-lg">
                  <Mail size={16} />
                </span>
                <span className="text-xs font-bold text-slate-300 tracking-wider uppercase">Simulated Email Sent (Testing Console)</span>
              </div>
              <button 
                onClick={() => setLatestSimulatedEmail(null)}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 text-xs font-medium text-slate-400">
              <div className="grid grid-cols-[60px_1fr] gap-1 pb-3 border-b border-slate-800">
                <span className="font-semibold text-slate-500">To:</span>
                <span className="text-slate-200 font-mono">{latestSimulatedEmail.to}</span>
                <span className="font-semibold text-slate-500">Subject:</span>
                <span className="text-slate-100 font-bold">{latestSimulatedEmail.subject}</span>
              </div>

              <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 font-mono text-slate-300 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                {latestSimulatedEmail.body}
              </div>

              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-300 text-[11px] leading-relaxed">
                <strong>💡 Tip for Testers:</strong> You can click the button below to instantly navigate to the onboarding portal with this email and complete the registration.
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setLatestSimulatedEmail(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-all cursor-pointer"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  setOnboardingEmail(latestSimulatedEmail.to);
                  setLatestSimulatedEmail(null);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer flex items-center gap-1"
              >
                👉 Go to Onboarding Page
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

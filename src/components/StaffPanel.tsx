/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { StaffProfile, Shift, FestivalEvent, TimeLog, BreakLog, LocationChangeLog, Invoice, InvoiceShift, InvoiceExpense } from '../types';
import { CodeOfConduct } from './CodeOfConduct';
import { 
  User, Calendar, Clock, DollarSign, CheckCircle2, XCircle, AlertCircle, 
  MapPin, Play, Square, Pause, RotateCw, Footprints, Check, Edit2, ShieldAlert,
  Lock, Star, Upload, FileText, Plus, Trash2, Download
} from 'lucide-react';
import { downloadInvoice } from '../utils/invoiceDownload';

interface StaffPanelProps {
  profile: StaffProfile;
  events: FestivalEvent[];
  shifts: Shift[];
  timeLogs: TimeLog[];
  invoices: Invoice[];
  onUpdateProfile: (updatedProfile: StaffProfile) => void;
  onRespondToShift: (shiftId: string, status: 'accepted' | 'denied') => void;
  onClockIn: (shiftId: string, locationName: string) => void;
  onClockOut: (shiftId: string, feedback?: { approval: string; rating: number; improvement: string }) => void;
  onStartBreak: (shiftId: string) => void;
  onEndBreak: (shiftId: string) => void;
  onMoveLocation: (shiftId: string, newLocation: string) => void;
  onSubmitInvoice: (invoice: Invoice) => void;
}

export const StaffPanel: React.FC<StaffPanelProps> = ({
  profile,
  events,
  shifts,
  timeLogs,
  invoices,
  onUpdateProfile,
  onRespondToShift,
  onClockIn,
  onClockOut,
  onStartBreak,
  onEndBreak,
  onMoveLocation,
  onSubmitInvoice
}) => {
  const [activeTab, setActiveTab] = useState<'shifts' | 'profile' | 'clockin' | 'invoices'>('shifts');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [shiftCategory, setShiftCategory] = useState<'pending' | 'confirmed' | 'completed'>('pending');

  // States for clock out feedback questionnaire
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackApproval, setFeedbackApproval] = useState('');
  const [feedbackRating, setFeedbackRating] = useState<number>(0);
  const [feedbackImprovement, setFeedbackImprovement] = useState('');
  const [feedbackError, setFeedbackError] = useState('');

  // Edit Profile fields
  const [prefName, setPrefName] = useState(profile.preferredName);
  const [fullName, setFullName] = useState(profile.fullName);
  const [pronouns, setPronouns] = useState(profile.pronouns);
  const [phone, setPhone] = useState(profile.phoneNumber);
  const [email, setEmail] = useState(profile.email);
  const [address, setAddress] = useState(profile.address);
  
  // Financial
  const [bankName, setBankName] = useState(profile.financialDetails.bankName);
  const [nameOnAccount, setNameOnAccount] = useState(profile.financialDetails.nameOnAccount);
  const [sortCode, setSortCode] = useState(profile.financialDetails.sortCode);
  const [accountNumber, setAccountNumber] = useState(profile.financialDetails.accountNumber);

  // Emergency
  const [emName, setEmName] = useState(profile.emergencyContact.name);
  const [emPhone, setEmPhone] = useState(profile.emergencyContact.number);
  const [emRel, setEmRel] = useState(profile.emergencyContact.relationship);

  // Medical
  const [medConditions, setMedConditions] = useState(profile.medicalConditions);
  const [serAllergies, setSerAllergies] = useState(profile.seriousAllergies);

  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');

  // Invoices & Expenses Drafting States
  const [invoiceEventId, setInvoiceEventId] = useState('');
  const [draftContactDetails, setDraftContactDetails] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    address: '',
  });
  const [draftFinancialDetails, setDraftFinancialDetails] = useState({
    bankName: '',
    nameOnAccount: '',
    sortCode: '',
    accountNumber: '',
  });
  const [draftShifts, setDraftShifts] = useState<InvoiceShift[]>([]);
  const [draftExpenses, setDraftExpenses] = useState<InvoiceExpense[]>([]);
  const [invoiceSuccessMsg, setInvoiceSuccessMsg] = useState('');
  const [invoiceErrorMsg, setInvoiceErrorMsg] = useState('');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  const getShiftDefaultHours = (shift: Shift) => {
    const log = timeLogs.find(l => l.shiftId === shift.id && l.staffId === profile.id);
    if (log && log.clockInTime && log.clockOutTime) {
      const diffMs = new Date(log.clockOutTime).getTime() - new Date(log.clockInTime).getTime();
      const diffHrs = diffMs / (1000 * 60 * 60);
      const breakHrs = (shift.unpaidBreakMinutes || 0) / 60;
      return Math.max(0, parseFloat((diffHrs - breakHrs).toFixed(2)));
    } else {
      const [sh, sm] = shift.startTime.split(':').map(Number);
      const [eh, em] = shift.endTime.split(':').map(Number);
      let scheduledDiffHrs = (eh + em/60) - (sh + sm/60);
      if (scheduledDiffHrs < 0) {
        scheduledDiffHrs += 24;
      }
      const breakHrs = (shift.unpaidBreakMinutes || 0) / 60;
      return Math.max(0, parseFloat((scheduledDiffHrs - breakHrs).toFixed(2)));
    }
  };

  // Sync draft details on event select
  useEffect(() => {
    if (invoiceEventId) {
      setDraftContactDetails({
        fullName: profile.fullName,
        email: profile.email,
        phoneNumber: profile.phoneNumber,
        address: profile.address,
      });
      setDraftFinancialDetails({
        bankName: profile.financialDetails.bankName,
        nameOnAccount: profile.financialDetails.nameOnAccount,
        sortCode: profile.financialDetails.sortCode,
        accountNumber: profile.financialDetails.accountNumber,
      });

      const eventShifts = myShifts.filter(s => s.eventId === invoiceEventId && s.status === 'accepted');
      const parsedInvoiceShifts = eventShifts.map(s => {
        const isDayRate = s.rateType === 'day';
        const hours = isDayRate ? 1 : getShiftDefaultHours(s);
        const rate = s.payRatePerHour || 12.00;
        return {
          shiftId: s.id,
          date: s.date,
          locationName: s.locationName,
          hours: hours,
          rate: rate,
          total: parseFloat((hours * rate).toFixed(2))
        };
      });
      setDraftShifts(parsedInvoiceShifts);
      setDraftExpenses([]);
    } else {
      setDraftShifts([]);
      setDraftExpenses([]);
    }
  }, [invoiceEventId, profile]);

  const myInvoices = invoices.filter(inv => inv.staffId === profile.id);

  // Transfer location state
  const [transferLocation, setTransferLocation] = useState('');

  // Timer state for clocked in shift
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Sync edit profile fields when profile changes
  useEffect(() => {
    setPrefName(profile.preferredName);
    setFullName(profile.fullName);
    setPronouns(profile.pronouns);
    setPhone(profile.phoneNumber);
    setEmail(profile.email);
    setAddress(profile.address);
    setBankName(profile.financialDetails.bankName);
    setNameOnAccount(profile.financialDetails.nameOnAccount);
    setSortCode(profile.financialDetails.sortCode);
    setAccountNumber(profile.financialDetails.accountNumber);
    setEmName(profile.emergencyContact.name);
    setEmPhone(profile.emergencyContact.number);
    setEmRel(profile.emergencyContact.relationship);
    setMedConditions(profile.medicalConditions);
    setSerAllergies(profile.seriousAllergies);
  }, [profile]);

  // Find shifts allocated to this staff member
  const myShifts = shifts.filter((s) => s.allocatedStaffId === profile.id);

  // Categorize shifts into pending, confirmed, and completed
  const pendingShifts = myShifts.filter((s) => s.status === 'pending');
  const completedShifts = myShifts.filter((s) => {
    if (s.status !== 'accepted') return false;
    const hasClockedOut = timeLogs.some(
      (l) => l.shiftId === s.id && l.staffId === profile.id && l.clockOutTime
    );
    const isPast = new Date(s.date + 'T23:59:59') < new Date();
    return hasClockedOut || isPast;
  });
  const confirmedShifts = myShifts.filter((s) => {
    if (s.status !== 'accepted') return false;
    const isCompleted = completedShifts.some((c) => c.id === s.id);
    return !isCompleted;
  });

  // Find active time log if any (clocked in but not clocked out)
  const activeLog = timeLogs.find(
    (l) => l.staffId === profile.id && l.clockInTime && !l.clockOutTime
  );
  
  const activeShift = activeLog ? shifts.find((s) => s.id === activeLog.shiftId) : null;
  const activeEvent = activeShift ? events.find((e) => e.id === activeShift.eventId) : null;

  // Running Clock Timer Effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeLog && activeLog.clockInTime) {
      const updateTimer = () => {
        const inTime = new Date(activeLog.clockInTime!).getTime();
        const now = new Date().getTime();
        setElapsedSeconds(Math.max(0, Math.floor((now - inTime) / 1000)));
      };
      
      updateTimer(); // run once immediately
      interval = setInterval(updateTimer, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(interval);
  }, [activeLog]);

  // Check if current break is active
  const isCurrentlyOnBreak = activeLog?.breaks.some((b) => !b.end) || false;
  const currentActiveBreak = activeLog?.breaks.find((b) => !b.end);

  const handleSignCodeOfConduct = (signatureName: string) => {
    onUpdateProfile({
      ...profile,
      codeOfConductSigned: true,
      codeOfConductSignedAt: new Date().toISOString(),
      codeOfConductSignature: signatureName
    });
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      ...profile,
      fullName: fullName.trim(),
      preferredName: prefName.trim() || fullName.split(' ')[0],
      pronouns: pronouns.trim(),
      phoneNumber: phone.trim(),
      email: email.trim().toLowerCase(),
      address: address.trim(),
      financialDetails: {
        bankName: bankName.trim(),
        nameOnAccount: nameOnAccount.trim(),
        sortCode: sortCode.trim(),
        accountNumber: accountNumber.trim()
      },
      emergencyContact: {
        name: emName.trim(),
        number: emPhone.trim(),
        relationship: emRel.trim()
      },
      medicalConditions: medConditions.trim() || 'None',
      seriousAllergies: serAllergies.trim() || 'None'
    });
    setIsEditingProfile(false);
    setProfileSuccessMsg('Profile updated successfully!');
    setTimeout(() => setProfileSuccessMsg(''), 4000);
  };

  // Format stopwatch seconds as HH:MM:SS
  const formatStopwatch = (totalSecs: number): string => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return [
      hrs.toString().padStart(2, '0'),
      mins.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ].join(':');
  };

  // Calculate cumulative breaks duration in minutes
  const calculateTotalBreakMinutes = (log: TimeLog): number => {
    return log.breaks.reduce((acc, curr) => {
      const start = new Date(curr.start).getTime();
      const end = curr.end ? new Date(curr.end).getTime() : new Date().getTime();
      return acc + (end - start) / (1000 * 60);
    }, 0);
  };

  return (
    <div className="space-y-6" id="staff-panel-root">
      
      {/* Code of Conduct Sign-off Lock */}
      {!profile.codeOfConductSigned ? (
        <div className="space-y-6 animate-fade-in" id="coc-lock-container">
          <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 flex items-start gap-4">
            <ShieldAlert size={24} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-sm">Agreement Pending</h3>
              <p className="text-xs text-amber-700 leading-relaxed mt-1">
                You must read and digitally sign the official Festival Staff Code of Conduct below to unlock shift allocations, clock-in terminals, and payouts.
              </p>
            </div>
          </div>
          <CodeOfConduct
            isSigned={false}
            onSign={handleSignCodeOfConduct}
          />
        </div>
      ) : (
        <>
          {/* Welcome Dashboard */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-950 flex items-center gap-2">
                👋 Welcome, {profile.preferredName || profile.fullName}!
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                You are registered, compliant, and ready to work shifts. Use the dashboard to accept shifts and log clocks.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveTab('shifts')}
                className={`px-4 py-1.5 text-xs font-semibold rounded-xl cursor-pointer transition-all ${
                  activeTab === 'shifts'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                My Shifts ({myShifts.length})
              </button>
              <button
                onClick={() => setActiveTab('clockin')}
                className={`px-4 py-1.5 text-xs font-semibold rounded-xl cursor-pointer transition-all flex items-center gap-1.5 ${
                  activeTab === 'clockin'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                } ${activeLog ? 'border border-emerald-500/30' : ''}`}
              >
                {activeLog && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />}
                Timeclock Terminal
              </button>
              <button
                onClick={() => setActiveTab('profile')}
                className={`px-4 py-1.5 text-xs font-semibold rounded-xl cursor-pointer transition-all ${
                  activeTab === 'profile'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                My Profile Details
              </button>
              <button
                onClick={() => setActiveTab('invoices')}
                className={`px-4 py-1.5 text-xs font-semibold rounded-xl cursor-pointer transition-all ${
                  activeTab === 'invoices'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                Invoices & Expenses ({myInvoices.filter(inv => inv.status === 'pending' || inv.status === 'approved').length})
              </button>
            </div>
          </div>

          {/* Tab 1: My Shift Allocations */}
          {activeTab === 'shifts' && (
            <div className="space-y-6 animate-fade-in" id="staff-shifts-tab">
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                <h3 className="font-bold text-slate-900 text-base mb-1">Assigned Shifts & Notifications</h3>
                <p className="text-xs text-slate-500 mb-4">Confirm your attendance or let coordinator know if you cannot fulfill a shift.</p>

                {/* Sub-tabs for shifts category */}
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-5 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setShiftCategory('pending')}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      shiftCategory === 'pending'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                    Pending ({pendingShifts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setShiftCategory('confirmed')}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      shiftCategory === 'confirmed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    Confirmed ({confirmedShifts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setShiftCategory('completed')}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      shiftCategory === 'completed'
                        ? 'bg-indigo-100 text-indigo-800'
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                    Completed ({completedShifts.length})
                  </button>
                </div>

                {(() => {
                  const activeShiftsList = 
                    shiftCategory === 'pending' ? pendingShifts :
                    shiftCategory === 'confirmed' ? confirmedShifts :
                    completedShifts;

                  if (activeShiftsList.length === 0) {
                    return (
                      <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl space-y-2 bg-slate-50/10">
                        <Calendar className="mx-auto text-slate-300" size={32} />
                        <p className="text-sm font-semibold text-slate-500">No {shiftCategory} shifts assigned</p>
                        <p className="text-xs text-slate-400">There are no shifts in this category at the moment.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {activeShiftsList.map((shift) => {
                        const event = events.find((e) => e.id === shift.eventId);
                        if (!event) return null;

                        const shiftDateStr = new Date(shift.date).toLocaleDateString('en-GB', {
                          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                        });

                        return (
                          <div key={shift.id} className="border border-slate-100 rounded-xl p-5 hover:border-slate-300 transition-all bg-slate-50/20 flex flex-col justify-between gap-4">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="px-2 py-0.5 bg-slate-900 text-white font-semibold text-[10px] rounded-md">
                                  {event.name}
                                </span>
                                
                                {shift.status === 'accepted' && (
                                  <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full flex items-center gap-1">
                                    <CheckCircle2 size={12} /> Confirmed
                                  </span>
                                )}
                                {shift.status === 'pending' && (
                                  <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 text-xs font-bold rounded-full flex items-center gap-1 animate-pulse">
                                    <Clock size={12} /> Action Required
                                  </span>
                                )}
                                {shift.status === 'denied' && (
                                  <span className="px-2.5 py-0.5 bg-rose-50 text-rose-700 text-xs font-bold rounded-full flex items-center gap-1">
                                    <XCircle size={12} /> Declined
                                  </span>
                                )}
                              </div>

                              <div className="space-y-1">
                                <h4 className="font-extrabold text-slate-900 text-base flex items-center gap-1">
                                  <MapPin size={14} className="text-indigo-500" />
                                  {shift.locationName}
                                </h4>
                                <p className="text-xs text-slate-600 font-semibold">{shiftDateStr}</p>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100/60 mt-2">
                                <div>
                                  <span className="text-slate-400 font-semibold text-[9px] uppercase tracking-wider block">Shift Hours</span>
                                  <span className="font-mono text-slate-700 font-bold">{shift.startTime} - {shift.endTime}</span>
                                </div>
                                <div>
                                  <span className="text-slate-400 font-semibold text-[9px] uppercase tracking-wider block">
                                    {shift.rateType === 'day' ? 'Shift Type' : 'Unpaid Break'}
                                  </span>
                                  <span className="text-slate-700 font-medium">
                                    {shift.rateType === 'day' ? 'Flat Day Rate' : `${shift.unpaidBreakMinutes} mins`}
                                  </span>
                                </div>
                              </div>

                              {/* Pay Rate is ONLY visible to staff who are allocated to the shift! */}
                              <div className="mt-2.5 p-2 bg-slate-100/50 rounded-lg flex items-center justify-between border border-slate-100">
                                <span className="text-xs text-slate-500 font-semibold">Your Pay Rate:</span>
                                <span className="font-mono text-sm font-extrabold text-slate-800 flex items-center">
                                  <DollarSign size={14} className="text-slate-500" />
                                  {shift.payRatePerHour.toFixed(2)} {shift.rateType === 'day' ? '/day' : '/hr'}
                                </span>
                              </div>
                            </div>

                            {shift.status === 'pending' && (
                              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                                <button
                                  onClick={() => onRespondToShift(shift.id, 'denied')}
                                  className="flex-1 py-1.5 bg-white border border-rose-200 hover:border-rose-400 text-rose-700 text-xs font-bold rounded-lg transition-all cursor-pointer text-center"
                                >
                                  Decline
                                </button>
                                <button
                                  onClick={() => onRespondToShift(shift.id, 'accepted')}
                                  className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all cursor-pointer shadow-md shadow-emerald-600/10 text-center"
                                >
                                  Accept Shift
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Tab 2: Timeclock Terminal */}
          {activeTab === 'clockin' && (
            <div className="space-y-6 animate-fade-in" id="staff-clock-tab">
              
              {/* If there is an active clock-in log */}
              {activeLog && activeShift && activeEvent ? (
                <div className="bg-slate-900 text-slate-100 border border-slate-950 rounded-2xl overflow-hidden shadow-xl" id="active-terminal">
                  
                  {/* Header */}
                  <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                      </span>
                      <div>
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block">Shift Currently Active</span>
                        <h3 className="font-bold text-white text-base">{activeEvent.name}</h3>
                      </div>
                    </div>

                    <div className="px-3 py-1 bg-slate-800 rounded-lg text-xs font-semibold text-slate-300">
                      Zone: <span className="text-white font-bold">{activeLog.locationLogs[activeLog.locationLogs.length - 1]?.locationName || activeShift.locationName}</span>
                    </div>
                  </div>

                  {/* Stopwatch Area */}
                  <div className="p-8 text-center space-y-4">
                    <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">Elapsed Shift Duration</p>
                    <div className="text-5xl md:text-6xl font-mono font-extrabold text-white tracking-wider tabular-nums">
                      {formatStopwatch(elapsedSeconds)}
                    </div>
                    
                    <div className="flex justify-center gap-4 text-xs font-medium text-slate-400">
                      <span>Clocked in at: {new Date(activeLog.clockInTime!).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span>•</span>
                      <span>Accumulated break: {Math.round(calculateTotalBreakMinutes(activeLog))}m</span>
                    </div>
                  </div>

                  {/* Active break status indicator */}
                  {isCurrentlyOnBreak && currentActiveBreak && (
                    <div className="mx-6 p-3 bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-xl flex items-center justify-between text-xs font-semibold mb-2">
                      <div className="flex items-center gap-2">
                        <Pause size={14} className="animate-pulse" />
                        <span>You are currently clocked out on an UNPAID break.</span>
                      </div>
                      <span className="font-mono text-[10px] bg-amber-500/20 px-2 py-0.5 rounded text-amber-200">
                        Since {new Date(currentActiveBreak.start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}

                  {/* Clock Controls */}
                  <div className="p-6 bg-slate-950 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Break controller */}
                    <div>
                      {isCurrentlyOnBreak ? (
                        <button
                          onClick={() => onEndBreak(activeShift.id)}
                          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/10"
                        >
                          <Play size={16} />
                          End Break (Resume Work)
                        </button>
                      ) : (
                        <button
                          onClick={() => onStartBreak(activeShift.id)}
                          className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Pause size={16} />
                          Start Unpaid Break
                        </button>
                      )}
                    </div>

                    {/* Clock out */}
                    <button
                      onClick={() => {
                        setFeedbackApproval('');
                        setFeedbackRating(0);
                        setFeedbackImprovement('');
                        setFeedbackError('');
                        setShowFeedbackModal(true);
                      }}
                      className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-rose-600/10"
                    >
                      <Square size={16} />
                      Clock Out & End Shift
                    </button>
                  </div>

                  {/* Location changes log mid-shift */}
                  <div className="px-6 pb-6 pt-4 border-t border-slate-800/50 space-y-4 bg-slate-950/40">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Footprints size={14} className="text-indigo-400" />
                        Mid-Shift Location Transfers
                      </h4>
                      <span className="text-[10px] text-slate-500">Track zone assignments as you move around venue</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[10px] font-semibold text-slate-400">Choose Zone to Transfer To:</label>
                        <select
                          value={transferLocation}
                          onChange={(e) => setTransferLocation(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-slate-600 cursor-pointer"
                        >
                          <option value="">-- Choose Venue Sub-Location --</option>
                          {activeEvent.locations.map((loc, i) => (
                            <option key={i} value={loc}>
                              {loc}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        onClick={() => {
                          if (!transferLocation) return;
                          onMoveLocation(activeShift.id, transferLocation);
                          setTransferLocation('');
                        }}
                        disabled={!transferLocation}
                        className="py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <RotateCw size={12} />
                        Record Transfer
                      </button>
                    </div>

                    {/* Location history list */}
                    {activeLog.locationLogs.length > 0 && (
                      <div className="border border-slate-800 rounded-lg p-3 bg-slate-950">
                        <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mb-2">Logged Locations This Shift:</p>
                        <div className="space-y-2">
                          {activeLog.locationLogs.map((logItem, index) => {
                            const timeStr = new Date(logItem.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                            return (
                              <div key={index} className="flex items-center gap-3 text-xs text-slate-300">
                                <span className="font-mono text-slate-500 font-bold">{timeStr}</span>
                                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                                <span>Moved to <span className="text-white font-semibold">{logItem.locationName}</span></span>
                                {index === activeLog.locationLogs.length - 1 && (
                                  <span className="px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 text-[8px] font-bold rounded-md">
                                    Current Location
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Choose which confirmed shift to clock into */
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm" id="clockin-selection">
                  <h3 className="font-bold text-slate-900 text-base mb-1">Timeclock Terminal</h3>
                  <p className="text-xs text-slate-500 mb-4">Select your confirmed shift below to begin recording work hours.</p>

                  {myShifts.filter((s) => s.status === 'accepted').length === 0 ? (
                    <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl space-y-2">
                      <AlertCircle className="mx-auto text-slate-300" size={32} />
                      <p className="text-sm font-semibold text-slate-500">No Confirmed Shifts Available</p>
                      <p className="text-xs text-slate-400">You must accept a pending shift under the "My Shifts" tab before you can clock in.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {myShifts
                        .filter((s) => s.status === 'accepted')
                        .map((shift) => {
                          const event = events.find((e) => e.id === shift.eventId);
                          if (!event) return null;

                          // Find if there is historic completed log for this shift
                          const completedLog = timeLogs.find(
                            (l) => l.shiftId === shift.id && l.staffId === profile.id && l.clockOutTime
                          );

                          return (
                            <div key={shift.id} className="border border-slate-100 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/20 hover:border-slate-300 transition-colors">
                              <div>
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold text-[9px] rounded-md uppercase tracking-wider block w-fit mb-1">
                                  {event.name}
                                </span>
                                <h4 className="font-bold text-slate-900 text-base flex items-center gap-1.5">
                                  <MapPin size={14} className="text-indigo-500" />
                                  {shift.locationName}
                                </h4>
                                <div className="text-xs text-slate-500 font-medium flex items-center gap-3 mt-1">
                                  <span>Date: {shift.date}</span>
                                  <span>•</span>
                                  <span>Scheduled: {shift.startTime} - {shift.endTime}</span>
                                </div>
                              </div>

                               <div className="shrink-0">
                                {completedLog ? (
                                  <div className="text-right">
                                    <span className="px-2.5 py-0.5 bg-slate-100 text-slate-500 font-bold text-xs rounded-full inline-flex items-center gap-1">
                                      <Check size={12} /> Timesheet Clock Completed
                                    </span>
                                  </div>
                                ) : (
                                  (() => {
                                    const todayStr = new Date().toISOString().split('T')[0];
                                    const isToday = shift.date === todayStr;
                                    
                                    if (!isToday) {
                                      return (
                                        <div className="text-right space-y-1">
                                          <button
                                            disabled
                                            className="px-4 py-1.5 bg-slate-100 text-slate-400 font-bold text-xs rounded-xl cursor-not-allowed flex items-center gap-1.5 border border-slate-200 inline-flex ml-auto"
                                          >
                                            <Lock size={12} />
                                            Day Locked
                                          </button>
                                          <span className="text-[10px] text-rose-500 font-bold block">
                                            Clock-in allowed only on {shift.date}
                                          </span>
                                        </div>
                                      );
                                    }

                                    return (
                                      <button
                                        onClick={() => onClockIn(shift.id, shift.locationName)}
                                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-emerald-600/10"
                                      >
                                        <Play size={12} />
                                        Clock In & Start Shift
                                      </button>
                                    );
                                  })()
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: My Profile Details */}
          {activeTab === 'profile' && (
            <div className="space-y-6 animate-fade-in" id="staff-profile-tab">
              {profileSuccessMsg && (
                <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-xl text-sm font-semibold flex items-center gap-1.5">
                  <Check size={16} />
                  {profileSuccessMsg}
                </div>
              )}

              <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-slate-900 text-white rounded-xl">
                      <User size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">{profile.fullName}'s Profile</h3>
                      <p className="text-xs text-slate-500">Edit your credentials, billing bank information, and medical declarations</p>
                    </div>
                  </div>

                  {!isEditingProfile && (
                    <button
                      onClick={() => setIsEditingProfile(true)}
                      className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-slate-900/10"
                    >
                      <Edit2 size={12} />
                      Edit Profile
                    </button>
                  )}
                </div>

                {isEditingProfile ? (
                  <form onSubmit={handleSaveProfile} className="p-6 space-y-6">
                    
                    {/* General */}
                    <div className="space-y-4">
                      <h4 className="text-xs uppercase tracking-wider font-extrabold text-slate-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" /> Personal Info
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-600">Full Legal Name *</label>
                          <input
                            type="text"
                            required
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-none"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-600">Preferred Name</label>
                            <input
                              type="text"
                              value={prefName}
                              onChange={(e) => setPrefName(e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-600">Pronouns</label>
                            <input
                              type="text"
                              value={pronouns}
                              onChange={(e) => setPronouns(e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-600">Email Address *</label>
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-600">Phone Number *</label>
                          <input
                            type="tel"
                            required
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-600">Home Address *</label>
                        <textarea
                          required
                          rows={2}
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-none resize-none"
                        />
                      </div>
                    </div>

                    {/* Financial */}
                    <div className="space-y-4 pt-2 border-t border-slate-50">
                      <h4 className="text-xs uppercase tracking-wider font-extrabold text-slate-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" /> Financial Billing Details
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-600">Bank Name</label>
                          <input
                            type="text"
                            required
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-600">Name on Account</label>
                          <input
                            type="text"
                            required
                            value={nameOnAccount}
                            onChange={(e) => setNameOnAccount(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-600">Sort Code</label>
                          <input
                            type="text"
                            required
                            value={sortCode}
                            onChange={(e) => setSortCode(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-600">Account Number</label>
                          <input
                            type="text"
                            required
                            value={accountNumber}
                            onChange={(e) => setAccountNumber(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Emergency Contact */}
                    <div className="space-y-4 pt-2 border-t border-slate-50">
                      <h4 className="text-xs uppercase tracking-wider font-extrabold text-slate-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" /> Emergency Contact
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-600">Contact Name</label>
                          <input
                            type="text"
                            required
                            value={emName}
                            onChange={(e) => setEmName(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-600">Contact Phone</label>
                          <input
                            type="tel"
                            required
                            value={emPhone}
                            onChange={(e) => setEmPhone(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-600">Relationship</label>
                          <input
                            type="text"
                            required
                            value={emRel}
                            onChange={(e) => setEmRel(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Medical & Allergies */}
                    <div className="space-y-4 pt-2 border-t border-slate-50">
                      <h4 className="text-xs uppercase tracking-wider font-extrabold text-slate-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" /> Medical & Allergies
                      </h4>
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-600">Pre-existing Medical Conditions</label>
                          <textarea
                            rows={2}
                            value={medConditions}
                            onChange={(e) => setMedConditions(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-none resize-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-600">Serious Allergies (e.g. EpiPen requirements)</label>
                          <textarea
                            rows={2}
                            value={serAllergies}
                            onChange={(e) => setSerAllergies(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-none resize-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-white">
                      <button
                        type="button"
                        onClick={() => setIsEditingProfile(false)}
                        className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl transition-all cursor-pointer shadow-md shadow-slate-900/10"
                      >
                        Save Changes
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="p-6 divide-y divide-slate-100 space-y-4">
                    {/* View mode */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Personal Details</span>
                        <div className="space-y-2 text-slate-800 text-sm">
                          <div><span className="font-semibold text-slate-500 text-xs block">Full Legal Name:</span> {profile.fullName}</div>
                          <div><span className="font-semibold text-slate-500 text-xs block">Preferred Name:</span> {profile.preferredName || 'None'}</div>
                          <div><span className="font-semibold text-slate-500 text-xs block">Pronouns:</span> {profile.pronouns}</div>
                          <div><span className="font-semibold text-slate-500 text-xs block">Email:</span> {profile.email}</div>
                          <div><span className="font-semibold text-slate-500 text-xs block">Phone:</span> {profile.phoneNumber}</div>
                          <div><span className="font-semibold text-slate-500 text-xs block">Home Address:</span> {profile.address}</div>
                        </div>
                      </div>

                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Financial Billing Details</span>
                        <div className="space-y-2 text-slate-800 text-sm bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <div><span className="font-semibold text-slate-500 text-xs">Bank Name:</span> {profile.financialDetails.bankName}</div>
                          <div><span className="font-semibold text-slate-500 text-xs block mt-1.5">Name on Account:</span> {profile.financialDetails.nameOnAccount}</div>
                          <div className="grid grid-cols-2 gap-2 mt-1.5">
                            <div><span className="font-semibold text-slate-500 text-xs block">Sort Code:</span> {profile.financialDetails.sortCode}</div>
                            <div><span className="font-semibold text-slate-500 text-xs block">Account Number:</span> {profile.financialDetails.accountNumber}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 pb-4">
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Emergency Contact</span>
                        <div className="space-y-2 text-slate-800 text-sm">
                          <div><span className="font-semibold text-slate-500 text-xs">Contact Name:</span> {profile.emergencyContact.name}</div>
                          <div><span className="font-semibold text-slate-500 text-xs">Relationship:</span> {profile.emergencyContact.relationship}</div>
                          <div><span className="font-semibold text-slate-500 text-xs">Phone Number:</span> {profile.emergencyContact.number}</div>
                        </div>
                      </div>

                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Medical & Safety</span>
                        <div className="space-y-2 text-slate-800 text-sm">
                          <div>
                            <span className="font-semibold text-slate-500 text-xs block">Pre-existing Conditions:</span> 
                            {profile.medicalConditions || 'None registered'}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-500 text-xs block mt-1.5">Serious Allergies / EpiPen Requirements:</span> 
                            {profile.seriousAllergies && profile.seriousAllergies !== 'None' ? (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 font-semibold rounded-md border border-amber-100 text-xs inline-block mt-0.5">
                                {profile.seriousAllergies}
                              </span>
                            ) : 'None registered'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 flex items-center justify-between text-xs text-slate-400">
                      <span>Onboarded On: {new Date(profile.createdAt).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                        <Check size={14} /> Code of Conduct signed & active
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 4: Invoices & Expenses */}
          {activeTab === 'invoices' && (
            <div className="space-y-6 animate-fade-in" id="staff-invoices-tab">
              {invoiceSuccessMsg && (
                <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                  <Check size={16} />
                  {invoiceSuccessMsg}
                </div>
              )}
              {invoiceErrorMsg && (
                <div className="p-3 bg-rose-50 text-rose-800 border border-rose-100 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                  <AlertCircle size={16} />
                  {invoiceErrorMsg}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Submit New Invoice Panel */}
                <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-6">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base mb-1 flex items-center gap-1.5">
                      <FileText className="text-indigo-600" size={18} />
                      Create New Invoice
                    </h3>
                    <p className="text-xs text-slate-500">Draft your timesheet & expenses for worked and pre-agreed shifts.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 block">Select Festival Event *</label>
                    <select
                      value={invoiceEventId}
                      onChange={(e) => {
                        setInvoiceEventId(e.target.value);
                        setInvoiceErrorMsg('');
                        setInvoiceSuccessMsg('');
                      }}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="">-- Choose an Event --</option>
                      {events.map((evt) => (
                        <option key={evt.id} value={evt.id}>{evt.name}</option>
                      ))}
                    </select>
                  </div>

                  {invoiceEventId && (
                    <div className="space-y-6 animate-fade-in">
                      
                      {/* Contact details editable */}
                      <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-xl space-y-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">1. Confirm Contact Details</span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div className="space-y-1">
                            <label className="text-slate-500 font-semibold">Full Legal Name</label>
                            <input
                              type="text"
                              value={draftContactDetails.fullName}
                              onChange={(e) => setDraftContactDetails({ ...draftContactDetails, fullName: e.target.value })}
                              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-medium"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-slate-500 font-semibold">Email Address</label>
                            <input
                              type="email"
                              value={draftContactDetails.email}
                              onChange={(e) => setDraftContactDetails({ ...draftContactDetails, email: e.target.value })}
                              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-medium"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-slate-500 font-semibold">Phone Number</label>
                            <input
                              type="text"
                              value={draftContactDetails.phoneNumber}
                              onChange={(e) => setDraftContactDetails({ ...draftContactDetails, phoneNumber: e.target.value })}
                              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-medium"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-slate-500 font-semibold">Home Address</label>
                            <input
                              type="text"
                              value={draftContactDetails.address}
                              onChange={(e) => setDraftContactDetails({ ...draftContactDetails, address: e.target.value })}
                              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-medium"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Financial details editable */}
                      <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-xl space-y-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">2. Confirm Financial Details</span>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          <div className="space-y-1">
                            <label className="text-slate-500 font-semibold">Bank Name</label>
                            <input
                              type="text"
                              value={draftFinancialDetails.bankName}
                              onChange={(e) => setDraftFinancialDetails({ ...draftFinancialDetails, bankName: e.target.value })}
                              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-medium"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-slate-500 font-semibold">Name on Account</label>
                            <input
                              type="text"
                              value={draftFinancialDetails.nameOnAccount}
                              onChange={(e) => setDraftFinancialDetails({ ...draftFinancialDetails, nameOnAccount: e.target.value })}
                              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-medium"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-slate-500 font-semibold">Sort Code</label>
                            <input
                              type="text"
                              value={draftFinancialDetails.sortCode}
                              onChange={(e) => setDraftFinancialDetails({ ...draftFinancialDetails, sortCode: e.target.value })}
                              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-medium"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-slate-500 font-semibold">Account Number</label>
                            <input
                              type="text"
                              value={draftFinancialDetails.accountNumber}
                              onChange={(e) => setDraftFinancialDetails({ ...draftFinancialDetails, accountNumber: e.target.value })}
                              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-medium"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Shifts List with editable hours and rates */}
                      <div className="space-y-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">3. Review Worked Shifts</span>
                        {draftShifts.length === 0 ? (
                          <div className="p-4 bg-amber-50 text-amber-800 text-xs rounded-xl border border-amber-100 font-semibold">
                            No accepted shifts found for this event in your profile.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {draftShifts.map((sh, idx) => {
                              const origShift = shifts.find(s => s.id === sh.shiftId);
                              const isDayRate = origShift?.rateType === 'day';

                              return (
                                <div key={sh.shiftId} className="border border-slate-100 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs bg-slate-50/30">
                                  <div>
                                    <span className="font-bold text-slate-900 block">{sh.locationName}</span>
                                    <span className="text-slate-500 font-semibold">{sh.date} {isDayRate && <span className="ml-1 text-[10px] bg-emerald-50 text-emerald-700 px-1 py-0.5 rounded font-bold">Day Rate</span>}</span>
                                  </div>

                                  <div className="flex items-center gap-4 flex-wrap">
                                    <div className="flex items-center gap-1">
                                      <span className="text-slate-400 font-semibold">{isDayRate ? 'Days:' : 'Hours:'}</span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={sh.hours}
                                        onChange={(e) => {
                                          const hrs = parseFloat(e.target.value) || 0;
                                          const updated = [...draftShifts];
                                          updated[idx] = {
                                            ...sh,
                                            hours: hrs,
                                            total: parseFloat((hrs * sh.rate).toFixed(2))
                                          };
                                          setDraftShifts(updated);
                                        }}
                                        className="w-16 px-2 py-1 border border-slate-200 rounded bg-white text-center font-bold"
                                      />
                                    </div>

                                    <div className="flex items-center gap-1">
                                      <span className="text-slate-400 font-semibold">{isDayRate ? 'Rate: £' : 'Rate: £'}</span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={sh.rate}
                                        onChange={(e) => {
                                          const rt = parseFloat(e.target.value) || 0;
                                          const updated = [...draftShifts];
                                          updated[idx] = {
                                            ...sh,
                                            rate: rt,
                                            total: parseFloat((sh.hours * rt).toFixed(2))
                                          };
                                          setDraftShifts(updated);
                                        }}
                                        className="w-16 px-2 py-1 border border-slate-200 rounded bg-white text-center font-bold"
                                      />
                                    </div>

                                    <div className="font-bold text-slate-900 min-w-[60px] text-right">
                                      £{sh.total.toFixed(2)}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Expenses Section */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">4. Add Pre-Agreed Expenses</span>
                          <button
                            type="button"
                            onClick={() => {
                              const newExp: InvoiceExpense = {
                                id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                                description: '',
                                amount: 0,
                                documentName: '',
                                documentUrl: ''
                              };
                              setDraftExpenses([...draftExpenses, newExp]);
                            }}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Plus size={10} /> Add Expense Line
                          </button>
                        </div>
                        
                        <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-[11px] text-amber-800 font-semibold flex items-center gap-1.5">
                          <AlertCircle size={14} className="shrink-0" />
                          <span>Note: <strong className="text-amber-900">only pre agreed expenses may be added to invoices</strong>.</span>
                        </div>

                        {draftExpenses.length > 0 && (
                          <div className="space-y-3">
                            {draftExpenses.map((exp, idx) => (
                              <div key={exp.id} className="p-4 border border-slate-100 bg-slate-50/40 rounded-xl space-y-3 text-xs relative">
                                <button
                                  type="button"
                                  onClick={() => setDraftExpenses(draftExpenses.filter(e => e.id !== exp.id))}
                                  className="absolute top-3 right-3 text-slate-400 hover:text-rose-500 cursor-pointer p-1 rounded hover:bg-slate-100"
                                >
                                  <Trash2 size={14} />
                                </button>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div className="md:col-span-2 space-y-1">
                                    <label className="text-slate-500 font-semibold">Expense Description</label>
                                    <input
                                      type="text"
                                      placeholder="e.g. Travel costs / Parking pass"
                                      value={exp.description}
                                      onChange={(e) => {
                                        const updated = [...draftExpenses];
                                        updated[idx] = { ...exp, description: e.target.value };
                                        setDraftExpenses(updated);
                                      }}
                                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-medium"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="text-slate-500 font-semibold">Amount (£)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={exp.amount === 0 ? '' : exp.amount}
                                      onChange={(e) => {
                                        const updated = [...draftExpenses];
                                        updated[idx] = { ...exp, amount: parseFloat(e.target.value) || 0 };
                                        setDraftExpenses(updated);
                                      }}
                                      placeholder="0.00"
                                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-bold"
                                    />
                                  </div>
                                </div>

                                {/* Supporting Doc upload */}
                                <div className="space-y-1.5">
                                  <label className="text-slate-500 font-semibold block">Supporting Document or Image *</label>
                                  {exp.documentName ? (
                                    <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-between text-indigo-950">
                                      <div className="flex items-center gap-1.5 overflow-hidden">
                                        <FileText size={14} className="text-indigo-600 shrink-0" />
                                        <span className="truncate font-bold text-[11px]">{exp.documentName}</span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = [...draftExpenses];
                                          updated[idx] = { ...exp, documentName: '', documentUrl: '' };
                                          setDraftExpenses(updated);
                                        }}
                                        className="text-[10px] text-rose-600 font-bold hover:underline cursor-pointer"
                                      >
                                        Remove file
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="relative border border-dashed border-slate-200 hover:border-slate-300 rounded-xl p-4 bg-white text-center cursor-pointer transition-colors">
                                      <input
                                        type="file"
                                        accept="image/*,.pdf"
                                        required
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            const reader = new FileReader();
                                            reader.onload = () => {
                                              const updated = [...draftExpenses];
                                              updated[idx] = {
                                                ...exp,
                                                documentName: file.name,
                                                documentUrl: reader.result as string
                                              };
                                              setDraftExpenses(updated);
                                            };
                                            reader.readAsDataURL(file);
                                          }
                                        }}
                                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                                      />
                                      <Upload size={18} className="mx-auto text-slate-400 mb-1" />
                                      <span className="text-[11px] text-slate-500 font-bold block">Upload Receipt / Supporting Doc</span>
                                      <span className="text-[9px] text-slate-400 block mt-0.5">JPEG, PNG or PDF (Required for each expense)</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Calculations & Submit */}
                      <div className="pt-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="text-xs text-slate-500 font-semibold space-y-1 text-right md:text-left">
                          <div>Shifts Total: <span className="font-bold text-slate-800">£{draftShifts.reduce((acc, curr) => acc + curr.total, 0).toFixed(2)}</span></div>
                          <div>Expenses Total: <span className="font-bold text-slate-800">£{draftExpenses.reduce((acc, curr) => acc + curr.amount, 0).toFixed(2)}</span></div>
                          <div className="text-sm">Grand Total: <span className="font-extrabold text-indigo-700">£{(
                            draftShifts.reduce((acc, curr) => acc + curr.total, 0) +
                            draftExpenses.reduce((acc, curr) => acc + curr.amount, 0)
                          ).toFixed(2)}</span></div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (draftShifts.length === 0 && draftExpenses.length === 0) {
                              setInvoiceErrorMsg('Your invoice must contain at least one shift or one expense.');
                              return;
                            }
                            // Verify all expenses have a description, amount > 0, and a supporting document upload
                            const missingDoc = draftExpenses.some(e => !e.documentUrl || !e.description.trim() || e.amount <= 0);
                            if (missingDoc) {
                              setInvoiceErrorMsg('Please ensure all expenses have a description, amount > 0, and a supporting document uploaded.');
                              return;
                            }

                            const selectedEvent = events.find(e => e.id === invoiceEventId);
                            const totalShiftsAmount = draftShifts.reduce((acc, curr) => acc + curr.total, 0);
                            const totalExpensesAmount = draftExpenses.reduce((acc, curr) => acc + curr.amount, 0);

                            const newInvoice: Invoice = {
                              id: `inv-${Date.now()}`,
                              staffId: profile.id,
                              staffName: profile.fullName,
                              eventId: invoiceEventId,
                              eventName: selectedEvent?.name || 'Festival Event',
                              createdAt: new Date().toISOString(),
                              status: 'pending',
                              contactDetails: { ...draftContactDetails },
                              financialDetails: { ...draftFinancialDetails },
                              shifts: [...draftShifts],
                              expenses: [...draftExpenses],
                              totalShiftsAmount,
                              totalExpensesAmount,
                              grandTotal: totalShiftsAmount + totalExpensesAmount
                            };

                            onSubmitInvoice(newInvoice);
                            setInvoiceSuccessMsg('Your invoice has been successfully generated & submitted for coordinator approval.');
                            setInvoiceEventId('');
                            setInvoiceErrorMsg('');
                          }}
                          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-indigo-600/10 cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <FileText size={14} /> Submit Invoice
                        </button>
                      </div>

                    </div>
                  )}
                </div>

                {/* Left side: Invoice History list */}
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-4 h-fit">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base mb-1">Invoice History</h3>
                    <p className="text-xs text-slate-500">Track and view status of your previous submissions.</p>
                  </div>

                  {myInvoices.length === 0 ? (
                    <div className="text-center py-10 border-2 border-dashed border-slate-100 rounded-xl space-y-1.5">
                      <FileText size={24} className="mx-auto text-slate-300" />
                      <p className="text-xs font-bold text-slate-500">No invoices submitted yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {myInvoices.map((inv) => (
                        <div key={inv.id} className="border border-slate-100 rounded-xl p-3 bg-slate-50/40 text-xs flex flex-col gap-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-bold text-slate-800 block line-clamp-1">{inv.eventName}</span>
                              <span className="text-[10px] text-slate-400 font-semibold">{new Date(inv.createdAt).toLocaleDateString()}</span>
                            </div>
                            
                            {inv.status === 'pending' && (
                              <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[9px] font-extrabold rounded-md uppercase tracking-wider shrink-0">
                                Pending
                              </span>
                            )}
                            {inv.status === 'approved' && (
                              <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 text-[9px] font-extrabold rounded-md uppercase tracking-wider shrink-0">
                                Approved
                              </span>
                            )}
                            {inv.status === 'paid' && (
                              <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-extrabold rounded-md uppercase tracking-wider shrink-0">
                                Paid
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100">
                            <span className="text-slate-500 font-semibold">Grand Total:</span>
                            <span className="font-bold text-slate-900">£{inv.grandTotal.toFixed(2)}</span>
                          </div>

                          <div className="flex items-center justify-between mt-1">
                            <button
                              type="button"
                              onClick={() => setExpandedInvoiceId(expandedInvoiceId === inv.id ? null : inv.id)}
                              className="text-[10px] text-indigo-600 font-bold text-left hover:underline focus:outline-none cursor-pointer"
                            >
                              {expandedInvoiceId === inv.id ? 'Hide details ▲' : 'View details ▼'}
                            </button>

                            <button
                              type="button"
                              id={`download-invoice-staff-${inv.id}`}
                              onClick={() => downloadInvoice(inv)}
                              className="text-[10px] text-emerald-600 hover:text-emerald-700 font-bold text-right hover:underline focus:outline-none cursor-pointer flex items-center gap-1"
                            >
                              <Download size={11} /> Download HTML/PDF
                            </button>
                          </div>

                          {expandedInvoiceId === inv.id && (
                            <div className="p-2.5 bg-white border border-slate-100 rounded-lg space-y-2 mt-1 font-medium text-[10px] text-slate-600 animate-fade-in">
                              
                              <div>
                                <span className="font-bold text-slate-400 block uppercase text-[8px] tracking-wider">Billing Name</span>
                                <span className="text-slate-800">{inv.financialDetails.nameOnAccount}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <span className="font-bold text-slate-400 block uppercase text-[8px] tracking-wider">Sort Code</span>
                                  <span className="text-slate-800">{inv.financialDetails.sortCode}</span>
                                </div>
                                <div>
                                  <span className="font-bold text-slate-400 block uppercase text-[8px] tracking-wider">Account No</span>
                                  <span className="text-slate-800">{inv.financialDetails.accountNumber}</span>
                                </div>
                              </div>

                              <div className="border-t border-slate-100 pt-1.5">
                                <span className="font-bold text-slate-800 block mb-1">Worked Shifts:</span>
                                {inv.shifts.map(s => (
                                  <div key={s.shiftId} className="flex justify-between gap-2 text-slate-500 py-0.5">
                                    <span className="truncate">{s.locationName} ({s.hours}h)</span>
                                    <span className="font-bold text-slate-800">£{s.total.toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>

                              {inv.expenses.length > 0 && (
                                <div className="border-t border-slate-100 pt-1.5">
                                  <span className="font-bold text-slate-800 block mb-1">Expenses:</span>
                                  {inv.expenses.map(e => (
                                    <div key={e.id} className="flex flex-col gap-0.5 pb-1">
                                      <div className="flex justify-between gap-2 text-slate-500">
                                        <span>{e.description}</span>
                                        <span className="font-bold text-slate-800">£{e.amount.toFixed(2)}</span>
                                      </div>
                                      {e.documentName && (
                                        <div className="flex items-center gap-1 text-[9px] text-indigo-600 mt-0.5">
                                          <FileText size={10} />
                                          <a href={e.documentUrl} download={e.documentName} className="hover:underline font-bold truncate max-w-[150px]">{e.documentName}</a>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {inv.approvedByAdminName && (
                                <div className="pt-1.5 border-t border-slate-100 text-[9px] text-slate-400">
                                  Approved by coordinator {inv.approvedByAdminName}
                                </div>
                              )}
                            </div>
                          )}

                        </div>
                      ))}
                    </div>
                  )}

                </div>

              </div>
            </div>
          )}
        </>
      )}

      {/* Shift Feedback & Clock-Out Questionnaire Modal */}
      {showFeedbackModal && activeShift && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="feedback-modal">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl text-slate-800">
            {/* Header */}
            <div className="bg-slate-900 px-6 py-4 border-b border-slate-800 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-rose-500/10 text-rose-400 rounded-lg">
                  <Square size={16} />
                </span>
                <span className="text-sm font-bold tracking-wider uppercase">Shift Completion Questionnaire</span>
              </div>
              <button 
                onClick={() => setShowFeedbackModal(false)}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <XCircle size={18} />
              </button>
            </div>

            {/* Content Form */}
            <div className="p-6 space-y-4">
              <div className="p-3.5 bg-amber-50 border border-amber-100 rounded-xl text-amber-900 text-xs font-semibold leading-relaxed">
                ⚠️ You are about to clock out. To complete this action, please fill out the required feedback questions below for our event coordination log.
              </div>

              {feedbackError && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs font-bold">
                  {feedbackError}
                </div>
              )}

              {/* Question 1 (Mandatory) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  1. Did you start early, finish late or not have a break? If so, who was this approved by? *
                </label>
                <textarea
                  required
                  rows={3}
                  value={feedbackApproval}
                  onChange={(e) => setFeedbackApproval(e.target.value)}
                  placeholder="e.g. Yes, started 30m early. Approved by operations lead Sarah Smith. / No deviations."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-semibold resize-none"
                />
              </div>

              {/* Question 2 (Mandatory Star Rating) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  2. How was your shift? *
                </label>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFeedbackRating(star)}
                      className="p-1 hover:scale-110 transition-transform cursor-pointer"
                    >
                      <Star
                        size={28}
                        className={`${
                          star <= feedbackRating
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-300 hover:text-amber-200'
                        } transition-colors`}
                      />
                    </button>
                  ))}
                  {feedbackRating > 0 && (
                    <span className="text-xs font-bold text-slate-500 ml-2">
                      ({feedbackRating} / 5 stars)
                    </span>
                  )}
                </div>
              </div>

              {/* Question 3 (Optional) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  3. How can we improve your experience at our festival? <span className="text-slate-400 font-medium">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={feedbackImprovement}
                  onChange={(e) => setFeedbackImprovement(e.target.value)}
                  placeholder="Share any ideas, thoughts or complaints here to help us make the next festival shift even better!"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-semibold resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowFeedbackModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!feedbackApproval.trim()) {
                    setFeedbackError('Please complete Question 1 (Start/Finish/Break notes).');
                    return;
                  }
                  if (feedbackRating === 0) {
                    setFeedbackError('Please select a star rating for Question 2.');
                    return;
                  }

                  onClockOut(activeShift.id, {
                    approval: feedbackApproval.trim(),
                    rating: feedbackRating,
                    improvement: feedbackImprovement.trim()
                  });
                  setShowFeedbackModal(false);
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-rose-600/10 cursor-pointer flex items-center gap-1.5"
              >
                <Square size={12} /> Submit & Clock Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

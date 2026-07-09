/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { FestivalEvent, StaffProfile, Shift, TimeLog, Invitation, Invoice, InvoiceExpense, InvoiceShift } from '../types';
import { 
  Calendar, MapPin, Clock, Users, DollarSign, Plus, ArrowRight,
  AlertTriangle, CheckCircle, XCircle, Info, ShieldAlert, Award, Footprints, Layers,
  Edit, X, Trash2, Shield, UserPlus, Mail, Star, Check, FileText, Download, Printer,
  CloudLightning, ExternalLink
} from 'lucide-react';
import { downloadInvoice } from '../utils/invoiceDownload';

interface AdminPanelProps {
  events: FestivalEvent[];
  shifts: Shift[];
  staffProfiles: StaffProfile[];
  timeLogs: TimeLog[];
  invitations?: Invitation[];
  onCreateEvent: (event: Omit<FestivalEvent, 'id'>) => void;
  onUpdateEvent?: (event: FestivalEvent) => void;
  onCreateShift: (shift: Omit<Shift, 'id'>, count?: number) => void;
  onUpdateShift?: (shift: Shift) => void;
  onDeleteShift?: (shiftId: string) => void;
  onAllocateStaff: (shiftId: string, staffId: string | null) => void;
  onUpdateTimeLog?: (updatedLog: TimeLog) => void;
  onDeleteStaff?: (staffId: string) => void;
  onUpdateStaffRole?: (staffId: string, role: 'staff' | 'admin') => void;
  onInviteStaffEmail?: (email: string) => void;
  onDeleteInvitation?: (email: string) => void;
  onResendInvitation?: (email: string) => void;
  invoices?: Invoice[];
  onApproveInvoice?: (invoiceId: string, adminId: string, adminName: string) => void;
  onMarkInvoiceAsPaid?: (invoiceId: string) => void;
  onRejectInvoice?: (invoiceId: string, reason: string) => void;
  currentAdminProfile?: StaffProfile;
  googleUser?: any;
  googleToken?: string | null;
  backupSpreadsheetId?: string | null;
  onGoogleConnect?: () => Promise<void>;
  onGoogleDisconnect?: () => Promise<void>;
  onBackupAllShifts?: () => Promise<void>;
}

// Helper to parse time strings "HH:MM" into decimal hours
const timeToDecimal = (timeStr: string): number => {
  const [hrs, mins] = timeStr.split(':').map(Number);
  return hrs + mins / 60;
};

// Helper to format decimal hours as "Xh Ym"
const formatDecimalHours = (decimalHours: number): string => {
  if (decimalHours <= 0 || isNaN(decimalHours)) return '0h';
  const hrs = Math.floor(decimalHours);
  const mins = Math.round((decimalHours - hrs) * 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
};

// Helper to calculate duration in decimal hours between two ISO timestamps, subtracting breaks
const calculateClockedHours = (timeLog: TimeLog): number => {
  if (!timeLog.clockInTime || !timeLog.clockOutTime) return 0;
  
  const inTime = new Date(timeLog.clockInTime).getTime();
  const outTime = new Date(timeLog.clockOutTime).getTime();
  let durationMs = outTime - inTime;
  
  // Subtract break durations
  let breakMs = 0;
  timeLog.breaks.forEach((b) => {
    if (b.start && b.end) {
      breakMs += new Date(b.end).getTime() - new Date(b.start).getTime();
    }
  });
  
  const netMs = durationMs - breakMs;
  return Math.max(0, netMs / (1000 * 60 * 60));
};

export const AdminPanel: React.FC<AdminPanelProps> = ({
  events,
  shifts,
  staffProfiles,
  timeLogs,
  invitations = [],
  onCreateEvent,
  onUpdateEvent,
  onCreateShift,
  onUpdateShift,
  onDeleteShift,
  onAllocateStaff,
  onUpdateTimeLog,
  onDeleteStaff,
  onUpdateStaffRole,
  onInviteStaffEmail,
  onDeleteInvitation,
  onResendInvitation,
  invoices = [],
  onApproveInvoice,
  onMarkInvoiceAsPaid,
  onRejectInvoice,
  currentAdminProfile,
  googleUser,
  googleToken,
  backupSpreadsheetId,
  onGoogleConnect,
  onGoogleDisconnect,
  onBackupAllShifts
}) => {
  // Tabs
  const [activeTab, setActiveTab] = useState<'events' | 'shifts' | 'allocations' | 'payroll' | 'staff' | 'invoices'>('events');
  const [shiftsViewMode, setShiftsViewMode] = useState<'grid' | 'table'>('grid');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  
  // Selected state
  const [selectedEventId, setSelectedEventId] = useState<string>(events[0]?.id || '');

  // Event Editing States
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editEventName, setEditEventName] = useState('');
  const [editEventLocation, setEditEventLocation] = useState('');
  const [editEventStart, setEditEventStart] = useState('');
  const [editEventEnd, setEditEventEnd] = useState('');
  const [editEventLocations, setEditEventLocations] = useState<string[]>([]);
  const [newEventLocInput, setNewEventLocInput] = useState('');

  // Shift Editing Modal States
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [editShiftLocation, setEditShiftLocation] = useState('');
  const [editShiftDate, setEditShiftDate] = useState('');
  const [editShiftStart, setEditShiftStart] = useState('');
  const [editShiftEnd, setEditShiftEnd] = useState('');
  const [editShiftPayRate, setEditShiftPayRate] = useState('');
  const [editShiftRateType, setEditShiftRateType] = useState<'hourly' | 'day'>('hourly');
  const [editShiftUnpaidBreak, setEditShiftUnpaidBreak] = useState('');
  const [editShiftAllocateStaffId, setEditShiftAllocateStaffId] = useState('');

  // Local states for new staff directory features
  const [inviteEmail, setInviteEmail] = useState('');
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);

  // Invoice Management States
  const [rejectInvoiceId, setRejectInvoiceId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [adminExpandedInvoiceId, setAdminExpandedInvoiceId] = useState<string | null>(null);

  // Editing Timesheet Log state
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editInDate, setEditInDate] = useState<string>('');
  const [editInTime, setEditInTime] = useState<string>('');
  const [editOutDate, setEditOutDate] = useState<string>('');
  const [editOutTime, setEditOutTime] = useState<string>('');
  const [editBreaks, setEditBreaks] = useState<Array<{ startTime: string; endTime: string }>>([]);

  const parseIsoToDateAndTime = (isoString: string | null) => {
    if (!isoString) return { date: '', time: '' };
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return { date: '', time: '' };
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return {
      date: `${year}-${month}-${date}`,
      time: `${hours}:${minutes}`
    };
  };

  const combineDateAndTime = (dateStr: string, timeStr: string): string | null => {
    if (!dateStr || !timeStr) return null;
    const [hours, minutes] = timeStr.split(':').map(Number);
    const d = new Date(dateStr);
    d.setHours(hours);
    d.setMinutes(minutes);
    d.setSeconds(0);
    d.setMilliseconds(0);
    return d.toISOString();
  };

  const parseBreaks = (breaksList: any[], baseDateStr: string) => {
    return breaksList.map((b) => {
      const startObj = parseIsoToDateAndTime(b.start);
      const endObj = parseIsoToDateAndTime(b.end);
      return {
        startTime: startObj.time || '12:00',
        endTime: endObj.time || '12:30'
      };
    });
  };

  const reconstructBreaks = (editBreaksList: Array<{ startTime: string; endTime: string }>, baseDateStr: string) => {
    return editBreaksList.map((eb) => {
      const startIso = combineDateAndTime(baseDateStr, eb.startTime);
      const endIso = combineDateAndTime(baseDateStr, eb.endTime);
      return {
        start: startIso || new Date().toISOString(),
        end: endIso
      };
    });
  };

  const startEditingLog = (log: TimeLog, shift: Shift) => {
    setEditingLogId(log.id);
    
    // If no clock in, default to shift date and start time
    const inObj = parseIsoToDateAndTime(log.clockInTime || `${shift.date}T${shift.startTime}:00`);
    setEditInDate(inObj.date);
    setEditInTime(inObj.time);

    // If no clock out, default to shift date and end time
    const outObj = parseIsoToDateAndTime(log.clockOutTime || `${shift.date}T${shift.endTime}:00`);
    setEditOutDate(outObj.date);
    setEditOutTime(outObj.time);

    // Breaks
    const parsedBreaks = parseBreaks(log.breaks, shift.date);
    setEditBreaks(parsedBreaks);
  };

  const addEditBreakRow = () => {
    setEditBreaks([...editBreaks, { startTime: '12:00', endTime: '12:30' }]);
  };

  const removeEditBreakRow = (index: number) => {
    setEditBreaks(editBreaks.filter((_, i) => i !== index));
  };

  const updateEditBreak = (index: number, field: 'startTime' | 'endTime', value: string) => {
    setEditBreaks(
      editBreaks.map((b, i) => {
        if (i === index) {
          return { ...b, [field]: value };
        }
        return b;
      })
    );
  };

  const handleSaveTimesheet = (logId: string, shift: Shift, staffId: string) => {
    const combinedIn = combineDateAndTime(editInDate, editInTime);
    const combinedOut = combineDateAndTime(editOutDate, editOutTime);

    if (combinedIn && combinedOut && new Date(combinedIn) > new Date(combinedOut)) {
      alert('Clock-In time must be before Clock-Out time.');
      return;
    }

    const finalBreaks = reconstructBreaks(editBreaks, shift.date);
    const isTemp = logId.startsWith('log-temp-');
    
    const updatedLog: TimeLog = {
      id: isTemp ? `log-${Date.now()}` : logId,
      shiftId: shift.id,
      staffId: staffId,
      clockInTime: combinedIn,
      clockOutTime: combinedOut,
      breaks: finalBreaks,
      locationLogs: isTemp 
        ? [{ locationName: shift.locationName, timestamp: combinedIn || new Date().toISOString() }] 
        : (timeLogs.find(l => l.id === logId)?.locationLogs || [])
    };

    if (onUpdateTimeLog) {
      onUpdateTimeLog(updatedLog);
    }
    setEditingLogId(null);
  };
  
  // Create Event Form
  const [eventName, setEventName] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventStart, setEventStart] = useState('');
  const [eventEnd, setEventEnd] = useState('');
  const [eventLocationsInput, setEventLocationsInput] = useState('');
  const [eventFormError, setEventFormError] = useState('');

  // Create Shift Form
  const [shiftLocation, setShiftLocation] = useState('');
  const [newSubLocation, setNewSubLocation] = useState(''); // text to add custom sub-location on the fly
  const [shiftDate, setShiftDate] = useState('');
  const [shiftStart, setShiftStart] = useState('09:00');
  const [shiftEnd, setShiftEnd] = useState('17:00');
  const [shiftPayRate, setShiftPayRate] = useState('12.50');
  const [shiftRateType, setShiftRateType] = useState<'hourly' | 'day'>('hourly');
  const [shiftUnpaidBreak, setShiftUnpaidBreak] = useState('30');
  const [shiftAllocateStaffId, setShiftAllocateStaffId] = useState('unallocated');
  const [shiftCount, setShiftCount] = useState('1');
  const [shiftFormError, setShiftFormError] = useState('');

  const currentSelectedEvent = events.find((e) => e.id === selectedEventId);

  // Filter shifts of current selected event
  const currentEventShifts = shifts.filter((s) => s.eventId === selectedEventId);

  const handleExportRota = () => {
    if (currentEventShifts.length === 0) {
      alert("No shifts to export for the current event.");
      return;
    }

    const csvHeaders = ["Date", "Location/Zone", "Start Time", "End Time", "Staff Name", "Staff Email", "Staff Phone", "Status", "Rate", "Rate Type", "Unpaid Break (mins)"];

    const csvRows = currentEventShifts.map(shift => {
      const staff = staffProfiles.find(p => p.id === shift.allocatedStaffId);
      const dateFormatted = new Date(shift.date).toLocaleDateString('en-GB');
      const staffName = staff ? staff.fullName : "Unallocated";
      const staffEmail = staff ? staff.email : "N/A";
      const staffPhone = staff ? staff.phoneNumber : "N/A";
      const status = staff ? shift.status : "Open";
      const rate = shift.payRatePerHour.toFixed(2);
      const rateType = shift.rateType || "hourly";
      const breakMins = shift.unpaidBreakMinutes || 0;

      return [
        `"${dateFormatted}"`,
        `"${shift.locationName.replace(/"/g, '""')}"`,
        `"${shift.startTime}"`,
        `"${shift.endTime}"`,
        `"${staffName.replace(/"/g, '""')}"`,
        `"${staffEmail.replace(/"/g, '""')}"`,
        `"${staffPhone.replace(/"/g, '""')}"`,
        `"${status}"`,
        `"${rate}"`,
        `"${rateType}"`,
        `"${breakMins}"`
      ].join(',');
    });

    const csvContent = "\uFEFF" + [csvHeaders.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `staff_rota_${currentSelectedEvent?.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadOutstandingInvoices = () => {
    const outstanding = invoices.filter(inv => inv.status === 'approved' || inv.status === 'pending');
    if (outstanding.length === 0) {
      alert("There are no outstanding (unpaid or pending approval) invoices to download.");
      return;
    }

    outstanding.forEach((invoice, index) => {
      setTimeout(() => {
        downloadInvoice(invoice);
      }, index * 200); // 200ms stagger to prevent browser blocking multiple downloads
    });
  };

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    setEventFormError('');

    if (!eventName.trim() || !eventLocation.trim() || !eventStart || !eventEnd) {
      setEventFormError('All fields are required.');
      return;
    }

    if (new Date(eventStart) > new Date(eventEnd)) {
      setEventFormError('Start date must be before or equal to End date.');
      return;
    }

    // Split locations by comma
    const parsedLocations = eventLocationsInput
      .split(',')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const fallbackLocations = parsedLocations.length > 0 ? parsedLocations : ['Main Arena', 'Staff Area'];

    onCreateEvent({
      name: eventName.trim(),
      location: eventLocation.trim(),
      startDate: eventStart,
      endDate: eventEnd,
      locations: fallbackLocations
    });

    // Reset Form
    setEventName('');
    setEventLocation('');
    setEventStart('');
    setEventEnd('');
    setEventLocationsInput('');
    setEventFormError('');
  };

  const startEditingEvent = (evt: FestivalEvent) => {
    setEditingEventId(evt.id);
    setEditEventName(evt.name);
    setEditEventLocation(evt.location);
    setEditEventStart(evt.startDate);
    setEditEventEnd(evt.endDate);
    setEditEventLocations([...evt.locations]);
    setNewEventLocInput('');
  };

  const handleAddEditLocation = () => {
    if (newEventLocInput.trim() && !editEventLocations.includes(newEventLocInput.trim())) {
      setEditEventLocations([...editEventLocations, newEventLocInput.trim()]);
      setNewEventLocInput('');
    }
  };

  const handleRemoveEditLocation = (locToRemove: string) => {
    setEditEventLocations(editEventLocations.filter(l => l !== locToRemove));
  };

  const handleSaveEventEdits = () => {
    if (!editEventName.trim() || !editEventLocation.trim() || !editEventStart || !editEventEnd) {
      alert("All fields are required.");
      return;
    }
    if (new Date(editEventStart) > new Date(editEventEnd)) {
      alert("Start date must be before or equal to End date.");
      return;
    }
    if (onUpdateEvent) {
      onUpdateEvent({
        id: editingEventId!,
        name: editEventName.trim(),
        location: editEventLocation.trim(),
        startDate: editEventStart,
        endDate: editEventEnd,
        locations: editEventLocations.length > 0 ? editEventLocations : ['Main Arena']
      });
    }
    setEditingEventId(null);
  };

  const startEditingShift = (shf: Shift) => {
    setEditingShiftId(shf.id);
    setEditShiftLocation(shf.locationName);
    setEditShiftDate(shf.date);
    setEditShiftStart(shf.startTime);
    setEditShiftEnd(shf.endTime);
    setEditShiftPayRate(String(shf.payRatePerHour));
    setEditShiftRateType(shf.rateType || 'hourly');
    setEditShiftUnpaidBreak(String(shf.unpaidBreakMinutes || 0));
    setEditShiftAllocateStaffId(shf.allocatedStaffId || 'unallocated');
  };

  const handleSaveShiftEdits = () => {
    if (!editingShiftId) return;
    const shift = shifts.find(s => s.id === editingShiftId);
    if (!shift) return;

    if (!editShiftLocation || !editShiftDate || !editShiftStart || !editShiftEnd) {
      alert("All fields are required.");
      return;
    }

    const startDec = timeToDecimal(editShiftStart);
    const endDec = timeToDecimal(editShiftEnd);
    if (startDec >= endDec) {
      alert("Shift start time must be before end time.");
      return;
    }

    const payRateNum = parseFloat(editShiftPayRate);
    if (isNaN(payRateNum) || payRateNum <= 0) {
      alert("Please enter a valid pay rate.");
      return;
    }

    const breakMinNum = parseInt(editShiftUnpaidBreak);
    if (isNaN(breakMinNum) || breakMinNum < 0) {
      alert("Please enter valid unpaid break minutes.");
      return;
    }

    const allocatedStaffId = editShiftAllocateStaffId === 'unallocated' ? null : editShiftAllocateStaffId;

    if (onUpdateShift) {
      onUpdateShift({
        ...shift,
        locationName: editShiftLocation,
        date: editShiftDate,
        startTime: editShiftStart,
        endTime: editShiftEnd,
        payRatePerHour: payRateNum,
        rateType: editShiftRateType,
        unpaidBreakMinutes: breakMinNum,
        allocatedStaffId,
        status: shift.allocatedStaffId === allocatedStaffId ? shift.status : 'pending'
      });
    }

    setEditingShiftId(null);
  };

  const handleDeleteShiftClick = (shiftId: string) => {
    if (window.confirm("Are you sure you want to delete this shift? This action cannot be undone.")) {
      if (onDeleteShift) {
        onDeleteShift(shiftId);
      }
    }
  };

  const handleCreateShift = (e: React.FormEvent) => {
    e.preventDefault();
    setShiftFormError('');

    if (!selectedEventId) {
      setShiftFormError('Please select or create an event first.');
      return;
    }

    const event = events.find((e) => e.id === selectedEventId);
    if (!event) return;

    // Validate date is within event range
    if (shiftDate < event.startDate || shiftDate > event.endDate) {
      setShiftFormError(`Shift date must be within event dates: ${event.startDate} to ${event.endDate}`);
      return;
    }

    let finalLocation = shiftLocation;
    if (shiftLocation === 'new-custom') {
      if (!newSubLocation.trim()) {
        setShiftFormError('Please type the name of the new location.');
        return;
      }
      finalLocation = newSubLocation.trim();
      // Add custom location directly to the selected event's array
      if (!event.locations.includes(finalLocation)) {
        event.locations.push(finalLocation);
      }
    }

    if (!finalLocation) {
      setShiftFormError('Please select or enter a shift location.');
      return;
    }

    const startDec = timeToDecimal(shiftStart);
    const endDec = timeToDecimal(shiftEnd);
    if (startDec >= endDec) {
      setShiftFormError('Shift start time must be before end time.');
      return;
    }

    const payRateNum = parseFloat(shiftPayRate);
    if (isNaN(payRateNum) || payRateNum <= 0) {
      setShiftFormError(shiftRateType === 'day' ? 'Please enter a valid day pay rate.' : 'Please enter a valid hourly pay rate.');
      return;
    }

    const breakMinNum = parseInt(shiftUnpaidBreak);
    if (isNaN(breakMinNum) || breakMinNum < 0) {
      setShiftFormError('Please enter valid unpaid break minutes.');
      return;
    }

    const allocatedStaffId = shiftAllocateStaffId === 'unallocated' ? null : shiftAllocateStaffId;

    const countNum = parseInt(shiftCount);
    const finalCount = isNaN(countNum) || countNum < 1 ? 1 : countNum;

    onCreateShift({
      eventId: selectedEventId,
      locationName: finalLocation,
      date: shiftDate,
      startTime: shiftStart,
      endTime: shiftEnd,
      allocatedStaffId,
      status: allocatedStaffId ? 'pending' : 'pending',
      unpaidBreakMinutes: breakMinNum,
      payRatePerHour: payRateNum,
      rateType: shiftRateType
    }, finalCount);

    // Reset Form
    setShiftLocation('');
    setNewSubLocation('');
    setShiftDate('');
    setShiftStart('09:00');
    setShiftEnd('17:00');
    setShiftPayRate('12.50');
    setShiftRateType('hourly');
    setShiftUnpaidBreak('30');
    setShiftAllocateStaffId('unallocated');
    setShiftCount('1');
    setShiftFormError('');
  };

  // Pre-calculations for Allocations Summary (Tab 3)
  const staffStats = staffProfiles
    .filter((staff) => staff.role === 'staff')
    .map((staff) => {
      // Find shifts allocated to this staff member for the SELECTED event
      const staffShifts = currentEventShifts.filter((s) => s.allocatedStaffId === staff.id);
      
      const totalShiftsCount = staffShifts.length;
      
      let totalHours = 0;
      let totalPay = 0;

      staffShifts.forEach((s) => {
        const start = timeToDecimal(s.startTime);
        const end = timeToDecimal(s.endTime);
        const duration = end - start;
        const breakHours = s.unpaidBreakMinutes / 60;
        const netHours = Math.max(0, duration - breakHours);
        totalHours += netHours;
        totalPay += s.rateType === 'day' ? s.payRatePerHour : (netHours * s.payRatePerHour);
      });

      return {
        staff,
        totalShiftsCount,
        totalHours,
        totalPay,
        shifts: staffShifts
      };
    })
    .filter((stat) => stat.totalShiftsCount > 0); // Only show staff allocated to shifts for this event

  // Pre-calculations for Clock-In Payroll (Tab 4)
  const payrollStats = staffProfiles
    .filter((staff) => staff.role === 'staff')
    .map((staff) => {
      // Find shifts allocated for this event
      const staffShifts = currentEventShifts.filter((s) => s.allocatedStaffId === staff.id);
      
      let totalClockedHours = 0;
      let totalEarnedPay = 0;
      const shiftsWorkedDetails: Array<{
        shift: Shift;
        log: TimeLog;
        clockedHours: number;
        earnedPay: number;
      }> = [];

      staffShifts.forEach((shift) => {
        // Find matching clock log
        const log = timeLogs.find((l) => l.shiftId === shift.id && l.staffId === staff.id);
        const clockedDecimal = log ? calculateClockedHours(log) : 0;
        const pay = shift.rateType === 'day' ? (clockedDecimal > 0 ? shift.payRatePerHour : 0) : clockedDecimal * shift.payRatePerHour;
        
        totalClockedHours += clockedDecimal;
        totalEarnedPay += pay;
        
        shiftsWorkedDetails.push({
          shift,
          log: log || {
            id: `log-temp-${shift.id}`,
            shiftId: shift.id,
            staffId: staff.id,
            clockInTime: null,
            clockOutTime: null,
            breaks: [],
            locationLogs: []
          },
          clockedHours: clockedDecimal,
          earnedPay: pay
        });
      });

      return {
        staff,
        totalClockedHours,
        totalEarnedPay,
        workedShiftsCount: shiftsWorkedDetails.filter(d => d.log.clockInTime && d.log.clockOutTime).length,
        details: shiftsWorkedDetails
      };
    });

  return (
    <div className="space-y-6" id="admin-panel-root">
      {/* Selector of Active Event */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-950 flex items-center gap-2">
            <span className="p-1.5 bg-slate-900 text-white rounded-lg"><Award size={18} /></span>
            Festival Coordinator HQ
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Create events, budget shifts, assign onboarded staff, and audit clocks & timesheets.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3.5 w-full md:w-auto">
          <div className="flex items-center gap-2.5 flex-1 md:flex-initial">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0">Selected Event:</label>
            <select
              value={selectedEventId}
              onChange={(e) => {
                setSelectedEventId(e.target.value);
                setShiftDate(''); // clear shift date so it doesn't default out of bounds
              }}
              className="flex-1 md:w-56 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-slate-800 cursor-pointer"
            >
              {events.length === 0 ? (
                <option value="">No events created yet</option>
              ) : (
                events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('staff')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 border shadow-xs ${
              activeTab === 'staff'
                ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-500'
                : 'bg-white hover:bg-slate-50 text-indigo-600 border-slate-200'
            }`}
          >
            <Users size={14} />
            Staff Directory & Status ({staffProfiles.length})
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-1 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('events')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'events'
              ? 'border-slate-900 text-slate-900 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <MapPin size={16} />
            Events Setup ({events.length})
          </div>
        </button>

        <button
          onClick={() => setActiveTab('shifts')}
          disabled={!selectedEventId}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 ${
            activeTab === 'shifts'
              ? 'border-slate-900 text-slate-900 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Clock size={16} />
            Shifts & Schedules ({currentEventShifts.length})
          </div>
        </button>

        <button
          onClick={() => setActiveTab('allocations')}
          disabled={!selectedEventId}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 ${
            activeTab === 'allocations'
              ? 'border-slate-900 text-slate-900 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Users size={16} />
            Staff Allocations & Expected Pay
          </div>
        </button>

        <button
          onClick={() => setActiveTab('payroll')}
          disabled={!selectedEventId}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 ${
            activeTab === 'payroll'
              ? 'border-slate-900 text-slate-900 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <DollarSign size={16} />
            Post-Event Clock-ins & Actual Payroll
          </div>
        </button>

        <button
          onClick={() => setActiveTab('invoices')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'invoices'
              ? 'border-slate-900 text-slate-900 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <FileText size={16} />
            Staff Invoices & Expenses ({invoices.filter(inv => inv.status === 'pending' || inv.status === 'approved').length})
          </div>
        </button>
      </div>

      {/* Tab 1: Events Setup */}
      {activeTab === 'events' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in" id="events-tab">
          
          {/* Create Event Form */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm h-fit">
            <h3 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2">
              <Plus size={18} className="text-indigo-600" />
              Create New Event
            </h3>

            {eventFormError && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-semibold mb-4 flex items-center gap-1.5">
                <AlertTriangle size={14} />
                {eventFormError}
              </div>
            )}

            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Event Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Savour Food Festival 2026"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-none bg-slate-5/50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Primary Location</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chelsea Physic Garden, London"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-none bg-slate-5/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Start Date</label>
                  <input
                    type="date"
                    required
                    value={eventStart}
                    onChange={(e) => setEventStart(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-none bg-slate-5/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">End Date</label>
                  <input
                    type="date"
                    required
                    value={eventEnd}
                    onChange={(e) => setEventEnd(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-none bg-slate-5/50"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  Sub-Locations (Zones)
                  <span className="text-[10px] text-slate-400 font-normal">(Comma separated)</span>
                </label>
                <input
                  type="text"
                  placeholder="Main Stage, VIP Bar, Ticket Booth, Gates"
                  value={eventLocationsInput}
                  onChange={(e) => setEventLocationsInput(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-none bg-slate-5/50"
                />
                <p className="text-[10px] text-slate-400">Specify zones inside the venue where staff will be clocking in and working.</p>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl transition-all shadow-md shadow-slate-900/10 cursor-pointer mt-2"
              >
                Create Event
              </button>
            </form>
          </div>

          {/* List of Created Events */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm lg:col-span-2">
            <h3 className="font-bold text-slate-900 text-base mb-4">Configured Festivals</h3>
            {events.length === 0 ? (
              <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl space-y-2">
                <Calendar className="mx-auto text-slate-300" size={32} />
                <p className="text-sm">No events configured. Use the form to establish your first festival.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {events.map((e) => {
                  const isActive = selectedEventId === e.id;
                  const eventShifts = shifts.filter((s) => s.eventId === e.id);
                  const startStr = new Date(e.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                  const endStr = new Date(e.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

                  if (editingEventId === e.id) {
                    return (
                      <div
                        key={e.id}
                        onClick={(evt) => evt.stopPropagation()}
                        className="p-5 rounded-xl border bg-slate-50 border-indigo-500 ring-1 ring-indigo-500 space-y-4 animate-fade-in"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                            <span className="p-1 bg-indigo-100 text-indigo-700 rounded-md"><Edit size={12} /></span>
                            Edit Festival Details
                          </h4>
                          <button
                            type="button"
                            onClick={() => setEditingEventId(null)}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                          >
                            <X size={16} />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Festival Name</label>
                            <input
                              type="text"
                              value={editEventName}
                              onChange={(evt) => setEditEventName(evt.target.value)}
                              className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-xl focus:border-slate-850 focus:outline-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Venue / Location</label>
                            <input
                              type="text"
                              value={editEventLocation}
                              onChange={(evt) => setEditEventLocation(evt.target.value)}
                              className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-xl focus:border-slate-850 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Start Date</label>
                            <input
                              type="date"
                              value={editEventStart}
                              onChange={(evt) => setEditEventStart(evt.target.value)}
                              className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-xl focus:border-slate-850 focus:outline-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">End Date</label>
                            <input
                              type="date"
                              value={editEventEnd}
                              onChange={(evt) => setEditEventEnd(evt.target.value)}
                              className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-xl focus:border-slate-850 focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Locations (Zones) Manager */}
                        <div className="space-y-2 pt-2 border-t border-slate-200/85">
                          <label className="text-[10px] font-bold text-slate-500 uppercase block">Sub-Locations / Zones</label>
                          
                          {/* Existing Locations Tag List with Delete (x) */}
                          <div className="flex flex-wrap gap-1.5">
                            {editEventLocations.map((loc, idx) => (
                              <span
                                key={idx}
                                className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-2xs"
                              >
                                {loc}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveEditLocation(loc)}
                                  className="text-slate-400 hover:text-rose-600 transition-colors ml-0.5 cursor-pointer"
                                  title={`Delete ${loc} location`}
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            ))}
                            {editEventLocations.length === 0 && (
                              <span className="text-xs text-rose-500 italic font-semibold">At least 1 location is required!</span>
                            )}
                          </div>

                          {/* Add Location input row */}
                          <div className="flex items-center gap-2 mt-2">
                            <input
                              type="text"
                              placeholder="e.g. Backstage Bar"
                              value={newEventLocInput}
                              onChange={(evt) => setNewEventLocInput(evt.target.value)}
                              onKeyDown={(evt) => {
                                if (evt.key === 'Enter') {
                                  evt.preventDefault();
                                  handleAddEditLocation();
                                }
                              }}
                              className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:border-slate-850 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={handleAddEditLocation}
                              className="px-3.5 py-1.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-all cursor-pointer"
                            >
                              Add Zone
                            </button>
                          </div>
                        </div>

                        {/* Buttons */}
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/85">
                          <button
                            type="button"
                            onClick={() => setEditingEventId(null)}
                            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-150 rounded-xl transition-all cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveEventEdits}
                            className="px-4 py-2 text-xs font-extrabold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all cursor-pointer shadow-xs"
                          >
                            Save Changes
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={e.id}
                      onClick={() => setSelectedEventId(e.id)}
                      className={`p-5 rounded-xl border transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        isActive
                          ? 'bg-slate-50 border-slate-800 ring-1 ring-slate-800'
                          : 'bg-white border-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-base">{e.name}</h4>
                          {isActive && (
                            <span className="px-2 py-0.5 bg-slate-900 text-white text-[10px] font-bold rounded-md">
                              Active Focus
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                          <span className="flex items-center gap-1">
                            <MapPin size={12} className="text-slate-400" />
                            {e.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar size={12} className="text-slate-400" />
                            {startStr} - {endStr}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 pt-1.5">
                          {e.locations.map((loc, i) => (
                            <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-semibold border border-slate-100">
                              {loc}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 shrink-0">
                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={(evt) => {
                            evt.stopPropagation();
                            startEditingEvent(e);
                          }}
                          className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/65 rounded-xl text-slate-500 hover:text-slate-800 transition-all cursor-pointer flex items-center justify-center"
                          title="Edit event details, locations and dates"
                        >
                          <Edit size={14} />
                        </button>

                        <div className="text-right">
                          <p className="text-xs text-slate-400 font-medium">Allocated Shifts</p>
                          <p className="font-extrabold text-slate-900 text-lg">{eventShifts.length}</p>
                        </div>
                        <ArrowRight size={18} className={`text-slate-300 transition-transform ${isActive ? 'translate-x-1 text-slate-800' : ''}`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Shifts Setup */}
      {activeTab === 'shifts' && currentSelectedEvent && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in" id="shifts-tab">
          
          {/* Create Shift Form */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm h-fit">
            <h3 className="font-bold text-slate-900 text-base mb-1 flex items-center gap-2">
              <Plus size={18} className="text-indigo-600" />
              Create Shift
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Event boundaries: <span className="font-semibold">{currentSelectedEvent.startDate}</span> to <span className="font-semibold">{currentSelectedEvent.endDate}</span>
            </p>

            {shiftFormError && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-semibold mb-4 flex items-center gap-1.5">
                <AlertTriangle size={14} />
                {shiftFormError}
              </div>
            )}

            <form onSubmit={handleCreateShift} className="space-y-4">
              
              {/* Location Selector within Event */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Location / Zone *</label>
                <select
                  required
                  value={shiftLocation}
                  onChange={(e) => setShiftLocation(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Choose Sub-Location --</option>
                  {currentSelectedEvent.locations.map((loc, i) => (
                    <option key={i} value={loc}>
                      {loc}
                    </option>
                  ))}
                  <option value="new-custom">+ Create New Sub-Location</option>
                </select>
              </div>

              {/* Add Sub-location dynamically if selected "Create New" */}
              {shiftLocation === 'new-custom' && (
                <div className="space-y-1 p-3 bg-slate-50 rounded-xl border border-slate-100 animate-slide-down">
                  <label className="text-xs font-semibold text-slate-700">New Location Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. VIP Cocktail Deck"
                    value={newSubLocation}
                    onChange={(e) => setNewSubLocation(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:border-slate-800 focus:outline-none"
                  />
                  <p className="text-[9px] text-slate-400 mt-0.5">Creating this shift will permanently append this zone to {currentSelectedEvent.name}.</p>
                </div>
              )}

              {/* Shift Date */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Shift Date *</label>
                <input
                  type="date"
                  required
                  min={currentSelectedEvent.startDate}
                  max={currentSelectedEvent.endDate}
                  value={shiftDate}
                  onChange={(e) => setShiftDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-none"
                />
              </div>

              {/* Start & End Times */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Start Time</label>
                  <input
                    type="time"
                    required
                    value={shiftStart}
                    onChange={(e) => setShiftStart(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">End Time</label>
                  <input
                    type="time"
                    required
                    value={shiftEnd}
                    onChange={(e) => setShiftEnd(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              {/* Rate Type Selector */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Rate Type</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setShiftRateType('hourly')}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      shiftRateType === 'hourly'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Hourly Rate
                  </button>
                  <button
                    type="button"
                    onClick={() => setShiftRateType('day')}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      shiftRateType === 'day'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Day Rate
                  </button>
                </div>
              </div>

              {/* Pay Rate and Break */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                    {shiftRateType === 'day' ? 'Pay Rate /day (£)' : 'Pay Rate /hr (£)'}
                    <Info size={11} className="text-slate-400" title="Hidden from staff until they are assigned." />
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={shiftPayRate}
                    onChange={(e) => setShiftPayRate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-none"
                  />
                </div>
                {shiftRateType === 'hourly' ? (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Unpaid Break (mins)</label>
                    <input
                      type="number"
                      min="0"
                      step="5"
                      required
                      value={shiftUnpaidBreak}
                      onChange={(e) => setShiftUnpaidBreak(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-none"
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400">Shift Type</label>
                    <div className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-semibold flex items-center h-[38px]">
                      Flat day rate basis
                    </div>
                  </div>
                )}
              </div>

              {/* Staff Allocation */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Allocate Onboarded Staff</label>
                <select
                  value={shiftAllocateStaffId}
                  onChange={(e) => setShiftAllocateStaffId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="unallocated">-- Leave Unallocated (Blank Shift) --</option>
                  {staffProfiles
                    .filter((p) => p.role === 'staff')
                    .map((p) => {
                      const hasSigned = p.codeOfConductSigned;
                      return (
                        <option 
                          key={p.id} 
                          value={p.id} 
                          disabled={!hasSigned}
                          className={!hasSigned ? "text-slate-300 italic" : "text-slate-800"}
                        >
                          {p.fullName} {hasSigned ? '' : '⚠️ (Code of Conduct NOT signed)'}
                        </option>
                      );
                    })}
                </select>
                <p className="text-[10px] text-slate-400">
                  Note: Staff MUST have signed the Code of Conduct to be selected. Unsigned profiles are disabled.
                </p>
              </div>

              {/* Bulk Creation Parameters */}
              <div className="space-y-1 p-3 bg-indigo-50/50 border border-indigo-100/60 rounded-xl">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Layers size={14} className="text-indigo-600" />
                  Bulk Shift Creation
                </label>
                <div className="flex items-center gap-2.5 mt-1.5">
                  <span className="text-xs text-slate-600 font-semibold whitespace-nowrap">Quantity:</span>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={shiftCount}
                    onChange={(e) => setShiftCount(e.target.value)}
                    className="w-20 px-2.5 py-1 text-center font-bold text-indigo-700 border border-slate-200 rounded-lg focus:border-indigo-600 focus:outline-none bg-white text-sm"
                  />
                  <span className="text-xs text-slate-500 font-medium">identical shift(s) to publish</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                  Create multiple unassigned copies of this shift to quickly build roster slots for this location.
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl transition-all shadow-md shadow-slate-900/10 cursor-pointer mt-2"
              >
                Create & Publish Shift
              </button>
            </form>
          </div>

          {/* List of Shifts & Allocations */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm lg:col-span-2 overflow-hidden flex flex-col">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Shifts configured for {currentSelectedEvent.name}</h3>
                <p className="text-xs text-slate-500 font-medium">Manage allocations, timings, and rosters</p>
              </div>
              
              {/* Controls */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Export Rota Button */}
                <button
                  type="button"
                  onClick={handleExportRota}
                  className="px-3.5 py-2 text-xs font-extrabold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border border-indigo-100 shadow-2xs"
                  title="Export full staff shift schedule as a CSV spreadsheet"
                >
                  <Download size={13} />
                  Export Rota (CSV)
                </button>

                {/* Print Rota Button */}
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(true)}
                  className="px-3.5 py-2 text-xs font-extrabold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border border-emerald-100 shadow-2xs"
                  title="Open a print-friendly layout of this rota (without shift rates)"
                >
                  <Printer size={13} />
                  Print Rota
                </button>

                {/* View Toggle */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShiftsViewMode('grid')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      shiftsViewMode === 'grid'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Calendar size={13} />
                    Schedule Grid
                  </button>
                  <button
                    type="button"
                    onClick={() => setShiftsViewMode('table')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      shiftsViewMode === 'table'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Layers size={13} />
                    Table List
                  </button>
                </div>
              </div>
            </div>

            {currentEventShifts.length === 0 ? (
              <div className="text-center py-16 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl space-y-2">
                <Clock className="mx-auto text-slate-300 animate-pulse" size={32} />
                <p className="text-sm">No shifts built yet for this festival.</p>
                <p className="text-xs text-slate-400">Use the Left Form to establish location specific shifts.</p>
              </div>
            ) : shiftsViewMode === 'table' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse" id="shifts-table">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-[10px] uppercase tracking-wider font-bold">
                      <th className="pb-3 font-semibold">Location & Date</th>
                      <th className="pb-3 font-semibold">Timings</th>
                      <th className="pb-3 font-semibold">Rate & Break</th>
                      <th className="pb-3 font-semibold">Assigned Staff</th>
                      <th className="pb-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentEventShifts.map((shift) => {
                      const staff = staffProfiles.find((p) => p.id === shift.allocatedStaffId);
                      const startDec = timeToDecimal(shift.startTime);
                      const endDec = timeToDecimal(shift.endTime);
                      const durHrs = endDec - startDec;
                      const netHrs = Math.max(0, durHrs - shift.unpaidBreakMinutes / 60);

                      return (
                        <tr key={shift.id} className="text-sm text-slate-800 hover:bg-slate-50/50 transition-colors">
                          <td className="py-4">
                            <div className="font-bold text-slate-900">{shift.locationName}</div>
                            <div className="text-xs text-slate-400 font-semibold mt-0.5 flex items-center gap-1">
                              <Calendar size={11} />
                              {new Date(shift.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </div>
                          </td>

                          <td className="py-4 font-mono text-xs">
                            <div className="flex items-center gap-1 text-slate-700 font-semibold">
                              <Clock size={12} className="text-slate-400" />
                              {shift.startTime} - {shift.endTime}
                            </div>
                            <div className="text-slate-400 mt-0.5">
                              {formatDecimalHours(durHrs)} Gross
                            </div>
                          </td>

                          <td className="py-4">
                            <div className="font-semibold text-slate-900">
                              £{shift.payRatePerHour.toFixed(2)}{shift.rateType === 'day' ? '/day' : '/hr'}
                            </div>
                            <div className="text-xs text-slate-400 font-medium">
                              {shift.rateType === 'day' ? (
                                <span className="text-emerald-600 font-semibold">Flat Day Rate</span>
                              ) : (
                                <span>-{shift.unpaidBreakMinutes}m unpaid break ({formatDecimalHours(netHrs)} net)</span>
                              )}
                            </div>
                          </td>

                          <td className="py-4">
                            {staff ? (
                              <div className="space-y-1">
                                <div className="font-semibold text-slate-900 flex items-center gap-1">
                                  {staff.preferredName} 
                                  <span className="text-[10px] font-normal text-slate-500">({staff.fullName})</span>
                                </div>
                                {shift.status === 'accepted' && (
                                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-md inline-flex items-center gap-1">
                                    <CheckCircle size={10} /> Accepted
                                  </span>
                                )}
                                {shift.status === 'pending' && (
                                  <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-md inline-flex items-center gap-1">
                                    <Clock size={10} /> Pending
                                  </span>
                                )}
                                {shift.status === 'denied' && (
                                  <span className="px-2 py-0.5 bg-rose-50 text-rose-700 text-[10px] font-bold rounded-md inline-flex items-center gap-1">
                                    <XCircle size={10} /> Denied
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-slate-400 italic">
                                <AlertTriangle size={12} className="text-amber-500" />
                                Unallocated
                              </div>
                            )}
                          </td>

                          <td className="py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <select
                                value={shift.allocatedStaffId || 'unallocated'}
                                onChange={(e) => {
                                  const val = e.target.value === 'unallocated' ? null : e.target.value;
                                  onAllocateStaff(shift.id, val);
                                }}
                                className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-slate-800 cursor-pointer text-slate-700"
                              >
                                <option value="unallocated">-- Allocate Staff --</option>
                                {staffProfiles
                                  .filter((p) => p.role === 'staff')
                                  .map((p) => {
                                    const hasSigned = p.codeOfConductSigned;
                                    return (
                                      <option 
                                        key={p.id} 
                                        value={p.id} 
                                        disabled={!hasSigned}
                                      >
                                        {p.preferredName} {hasSigned ? '' : '(CoC Pending)'}
                                      </option>
                                    );
                                  })}
                              </select>

                              {/* Edit Shift Button */}
                              <button
                                type="button"
                                onClick={() => startEditingShift(shift)}
                                className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-indigo-600 rounded-lg transition-all cursor-pointer flex items-center justify-center"
                                title="Edit date, timings, location, and rates of this shift"
                              >
                                <Edit size={12} />
                              </button>

                              {/* Delete Shift Button */}
                              <button
                                type="button"
                                onClick={() => handleDeleteShiftClick(shift.id)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-500 hover:text-rose-700 rounded-lg transition-all cursor-pointer flex items-center justify-center"
                                title="Delete this shift"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Grid Scheduler View Mode */
              <div className="overflow-x-auto border border-slate-150 rounded-2xl bg-slate-50/20" id="schedule-grid-container">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 text-xs border-b border-slate-200">
                      {/* Left Header Spacer */}
                      <th className="p-4 font-bold text-left border-r border-slate-200 min-w-[180px] sticky left-0 bg-slate-100 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                        Sub-Locations / Zones
                      </th>
                      {/* Event Days */}
                      {(() => {
                        const getDatesInRange = (startStr: string, endStr: string) => {
                          const dates = [];
                          const start = new Date(startStr);
                          const end = new Date(endStr);
                          if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];
                          const curr = new Date(start);
                          while (curr <= end) {
                            dates.push(curr.toISOString().split('T')[0]);
                            curr.setDate(curr.getDate() + 1);
                          }
                          return dates;
                        };
                        const dates = getDatesInRange(currentSelectedEvent.startDate, currentSelectedEvent.endDate);
                        return dates.map((dateStr) => {
                          const d = new Date(dateStr);
                          const weekday = d.toLocaleDateString('en-GB', { weekday: 'short' });
                          const dayNum = d.toLocaleDateString('en-GB', { day: 'numeric' });
                          const monthShort = d.toLocaleDateString('en-GB', { month: 'short' });
                          return (
                            <th key={dateStr} className="p-4 font-bold text-center border-r border-slate-200 min-w-[210px] last:border-r-0">
                              <div className="text-slate-900 font-extrabold">{weekday} {dayNum}</div>
                              <div className="text-[10px] text-slate-400 font-semibold">{monthShort}</div>
                            </th>
                          );
                        });
                      })()}
                    </tr>
                  </thead>
                  <tbody>
                    {currentSelectedEvent.locations.map((loc) => (
                      <tr key={loc} className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50/20">
                        {/* Sub-Location Name Header Row */}
                        <td className="p-4 font-bold text-sm text-slate-800 border-r border-slate-200 bg-white sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                          <div className="flex items-center gap-1.5">
                            <MapPin size={14} className="text-slate-400" />
                            <span>{loc}</span>
                          </div>
                        </td>

                        {/* Intersection Days */}
                        {(() => {
                          const getDatesInRange = (startStr: string, endStr: string) => {
                            const dates = [];
                            const start = new Date(startStr);
                            const end = new Date(endStr);
                            if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];
                            const curr = new Date(start);
                            while (curr <= end) {
                              dates.push(curr.toISOString().split('T')[0]);
                              curr.setDate(curr.getDate() + 1);
                            }
                            return dates;
                          };
                          const dates = getDatesInRange(currentSelectedEvent.startDate, currentSelectedEvent.endDate);
                          return dates.map((dateStr) => {
                            const cellShifts = currentEventShifts.filter(
                              (s) => s.locationName === loc && s.date === dateStr
                            );
                            return (
                              <td key={dateStr} className="p-3 border-r border-slate-200 last:border-r-0 align-top">
                                <div className="flex flex-col gap-2.5 h-full justify-between min-h-[160px]">
                                  {/* Shift list container */}
                                  <div className="space-y-2">
                                    {cellShifts.length === 0 ? (
                                      <div className="text-center py-8 text-[11px] text-slate-350 italic font-medium">
                                        No shifts
                                      </div>
                                    ) : (
                                      cellShifts.map((shift) => {
                                        const staff = staffProfiles.find((p) => p.id === shift.allocatedStaffId);
                                        const isConfirmed = shift.status === 'accepted';
                                        const isPending = shift.status === 'pending';
                                        const isDenied = shift.status === 'denied';

                                        let cardStyles = "border border-slate-200 bg-white shadow-xs p-2.5 rounded-xl text-xs flex flex-col gap-1.5 relative";
                                        if (staff) {
                                          if (isConfirmed) cardStyles = "border border-emerald-200 bg-emerald-50/40 text-emerald-950 p-2.5 rounded-xl text-xs flex flex-col gap-1.5 relative shadow-xs";
                                          else if (isPending) cardStyles = "border border-amber-200 bg-amber-50/45 text-amber-950 p-2.5 rounded-xl text-xs flex flex-col gap-1.5 relative shadow-xs";
                                          else if (isDenied) cardStyles = "border border-rose-200 bg-rose-50/40 text-rose-950 p-2.5 rounded-xl text-xs flex flex-col gap-1.5 relative shadow-xs";
                                        } else {
                                          cardStyles = "border border-dashed border-slate-250 bg-white/60 text-slate-500 p-2.5 rounded-xl text-xs flex flex-col gap-1.5 relative shadow-xs";
                                        }

                                        return (
                                          <div key={shift.id} className={cardStyles}>
                                            {/* Status Badge */}
                                            <div className="flex items-center justify-between gap-1 border-b border-slate-100/40 pb-1.5">
                                              <span className="font-extrabold font-mono text-[11px] tracking-tight text-slate-900 flex items-center gap-1">
                                                <Clock size={11} className="text-slate-400 shrink-0" />
                                                {shift.startTime} - {shift.endTime}
                                              </span>
                                              
                                              <div className="flex items-center gap-1 shrink-0">
                                                {/* Edit Icon */}
                                                <button
                                                  type="button"
                                                  onClick={() => startEditingShift(shift)}
                                                  className="p-1 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-md transition-colors cursor-pointer flex items-center justify-center"
                                                  title="Edit shift details"
                                                >
                                                  <Edit size={10} />
                                                </button>

                                                {/* Delete Icon */}
                                                <button
                                                  type="button"
                                                  onClick={() => handleDeleteShiftClick(shift.id)}
                                                  className="p-1 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded-md transition-colors cursor-pointer flex items-center justify-center"
                                                  title="Delete shift"
                                                >
                                                  <Trash2 size={10} />
                                                </button>

                                                <span className={`px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider ${
                                                  isConfirmed ? 'bg-emerald-100 text-emerald-800' :
                                                  isPending && staff ? 'bg-amber-100 text-amber-800' :
                                                  isDenied ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                  {staff ? shift.status : 'Open'}
                                                </span>
                                              </div>
                                            </div>

                                            {/* Staff Name & Pay info */}
                                            <div className="space-y-0.5">
                                              <div className="font-bold text-slate-900 flex items-center gap-1 flex-wrap">
                                                {staff ? (
                                                  <span>{staff.preferredName} <span className="text-[9px] font-medium text-slate-500">({staff.fullName.split(' ')[0]})</span></span>
                                                ) : (
                                                  <span className="italic text-slate-400 font-medium">Unallocated Slot</span>
                                                )}
                                              </div>
                                              <div className="text-[10px] text-slate-400 font-bold">
                                                £{shift.payRatePerHour.toFixed(2)}{shift.rateType === 'day' ? '/day' : '/hr'}
                                                {shift.rateType !== 'day' && <span className="font-medium"> ({shift.unpaidBreakMinutes}m break)</span>}
                                              </div>
                                            </div>

                                            {/* Allocation Selector directly inside grid card */}
                                            <div className="mt-1 pt-1.5 border-t border-slate-100/40">
                                              <select
                                                value={shift.allocatedStaffId || 'unallocated'}
                                                onChange={(e) => {
                                                  const val = e.target.value === 'unallocated' ? null : e.target.value;
                                                  onAllocateStaff(shift.id, val);
                                                }}
                                                className="w-full px-1.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 cursor-pointer focus:outline-none focus:border-slate-800"
                                              >
                                                <option value="unallocated">-- Open Slot --</option>
                                                {staffProfiles
                                                  .filter((p) => p.role === 'staff')
                                                  .map((p) => {
                                                    const hasSigned = p.codeOfConductSigned;
                                                    return (
                                                      <option 
                                                        key={p.id} 
                                                        value={p.id} 
                                                        disabled={!hasSigned}
                                                      >
                                                        {p.preferredName} {hasSigned ? '' : '(CoC⚠️)'}
                                                      </option>
                                                    );
                                                  })}
                                              </select>
                                            </div>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>

                                  {/* Day Cell Action + button to quickly add shift matching this location & date */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShiftLocation(loc);
                                      setShiftDate(dateStr);
                                      // Focus the create form element
                                      document.getElementById('shifts-tab')?.scrollIntoView({ behavior: 'smooth' });
                                      const dateInput = document.querySelector('input[type="date"]');
                                      if (dateInput instanceof HTMLInputElement) {
                                        dateInput.focus();
                                      }
                                    }}
                                    className="w-full py-1.5 border border-dashed border-slate-200 hover:border-indigo-400 bg-white/40 hover:bg-indigo-50/50 rounded-xl text-[10px] font-bold text-slate-400 hover:text-indigo-600 transition-all flex items-center justify-center gap-1 cursor-pointer"
                                    title={`Quick add shift for ${loc} on ${dateStr}`}
                                  >
                                    <Plus size={11} />
                                    Add Shift
                                  </button>
                                </div>
                              </td>
                            );
                          });
                        })()}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Staff Allocations & Budgeting */}
      {activeTab === 'allocations' && currentSelectedEvent && (
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm animate-fade-in" id="allocations-tab">
          <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-50 pb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Allocations Summary</h3>
              <p className="text-xs text-slate-500">Scheduled hours & expected payouts budgeted for {currentSelectedEvent.name}</p>
            </div>
            
            <div className="flex gap-4">
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Budgeted</span>
                <p className="font-extrabold text-slate-900 text-lg">
                  £{staffStats.reduce((acc, curr) => acc + curr.totalPay, 0).toFixed(2)}
                </p>
              </div>
              <div className="w-[1px] bg-slate-100" />
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Hours</span>
                <p className="font-extrabold text-slate-900 text-lg">
                  {formatDecimalHours(staffStats.reduce((acc, curr) => acc + curr.totalHours, 0))}
                </p>
              </div>
            </div>
          </div>

          {staffStats.length === 0 ? (
            <div className="text-center py-16 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl space-y-2">
              <Users className="mx-auto text-slate-300 animate-pulse" size={32} />
              <p className="text-sm">No staff members are currently allocated to shifts for this event.</p>
              <p className="text-xs text-slate-400">Allocate staff under the "Shifts & Schedules" tab to see them here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-[10px] uppercase tracking-wider font-bold">
                    <th className="pb-3 font-semibold">Staff Member</th>
                    <th className="pb-3 font-semibold">Allocated Shifts</th>
                    <th className="pb-3 font-semibold">Break Policy</th>
                    <th className="pb-3 font-semibold">Scheduled Hours (Net)</th>
                    <th className="pb-3 font-semibold">Expected Pay (Budget)</th>
                    <th className="pb-3 font-semibold">Emergency Contacts & Medical Info</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staffStats.map(({ staff, totalShiftsCount, totalHours, totalPay, shifts }) => {
                    return (
                      <tr key={staff.id} className="text-sm text-slate-800 hover:bg-slate-50/20 transition-colors">
                        <td className="py-4">
                          <div className="font-bold text-slate-900">{staff.fullName}</div>
                          <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
                            <span>{staff.preferredName} ({staff.pronouns})</span>
                            <span>•</span>
                            <span>{staff.phoneNumber}</span>
                          </div>
                        </td>

                        <td className="py-4 font-semibold text-slate-800">
                          {totalShiftsCount === 0 ? (
                            <span className="text-slate-400 font-normal">None allocated</span>
                          ) : (
                            <div className="space-y-1">
                              <span className="px-2.5 py-0.5 bg-slate-100 text-slate-800 rounded-md font-bold text-xs">
                                {totalShiftsCount} {totalShiftsCount === 1 ? 'shift' : 'shifts'}
                              </span>
                              <div className="text-[10px] text-slate-400 font-normal">
                                {shifts.map((s) => s.locationName).join(', ')}
                              </div>
                            </div>
                          )}
                        </td>

                        <td className="py-4 text-xs text-slate-500 font-medium">
                          {shifts.map((s) => `${s.unpaidBreakMinutes}m`).join(' + ') || 'N/A'}
                        </td>

                        <td className="py-4 font-mono font-semibold text-slate-900">
                          {formatDecimalHours(totalHours)}
                        </td>

                        <td className="py-4 font-mono font-bold text-indigo-700">
                          £{totalPay.toFixed(2)}
                        </td>

                        <td className="py-4 text-xs">
                          <div className="space-y-1">
                            <div className="text-slate-600 font-medium">
                              <span className="text-slate-400 uppercase tracking-widest font-semibold text-[9px] block">Emergency Contact</span>
                              {staff.emergencyContact.name} ({staff.emergencyContact.relationship}): {staff.emergencyContact.number}
                            </div>
                            
                            {/* Alert-based styling for serious allergies */}
                            {staff.seriousAllergies && staff.seriousAllergies !== 'None' && staff.seriousAllergies !== 'none' ? (
                              <div className="p-1.5 bg-amber-50 text-amber-800 border border-amber-100 rounded-md flex items-start gap-1 font-semibold max-w-xs">
                                <ShieldAlert size={12} className="shrink-0 mt-0.5 text-amber-600" />
                                <span className="text-[10px] leading-snug">{staff.seriousAllergies}</span>
                              </div>
                            ) : null}

                            {staff.medicalConditions && staff.medicalConditions !== 'None' && staff.medicalConditions !== 'none' ? (
                              <div className="text-slate-400 italic">
                                Med: {staff.medicalConditions}
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Post-Event Clock-ins & Actual Payroll */}
      {activeTab === 'payroll' && currentSelectedEvent && (
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm animate-fade-in" id="payroll-tab">
          <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-50 pb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Clocked Hours & Timesheet Payouts</h3>
              <p className="text-xs text-slate-500">Compare scheduled schedules with net completed clocks for {currentSelectedEvent.name}</p>
            </div>

            <div className="flex gap-4">
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Actual Payroll</span>
                <p className="font-extrabold text-emerald-700 text-lg">
                  £{payrollStats.reduce((acc, curr) => acc + curr.totalEarnedPay, 0).toFixed(2)}
                </p>
              </div>
              <div className="w-[1px] bg-slate-100" />
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Clocked Hours (Net)</span>
                <p className="font-extrabold text-slate-900 text-lg">
                  {formatDecimalHours(payrollStats.reduce((acc, curr) => acc + curr.totalClockedHours, 0))}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {payrollStats.length === 0 || payrollStats.every(s => s.details.length === 0) ? (
              <div className="text-center py-16 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl space-y-2">
                <Clock className="mx-auto text-slate-300 animate-pulse" size={32} />
                <p className="text-sm">No clocked records or allocated shifts found for this event yet.</p>
                <p className="text-xs text-slate-400">Staff members will see clock options in their dashboard once allocated shifts begin.</p>
              </div>
            ) : (
              payrollStats
                .filter((p) => p.details.length > 0)
                .map(({ staff, totalClockedHours, totalEarnedPay, details }) => {
                  return (
                    <div key={staff.id} className="border border-slate-100 rounded-xl p-5 bg-slate-50/30 space-y-4">
                      
                      {/* Header */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div>
                          <h4 className="font-bold text-slate-900 text-base">{staff.fullName} ({staff.preferredName})</h4>
                          <div className="flex items-center gap-4 text-xs text-slate-500 font-medium mt-0.5">
                            <span>Email: {staff.email}</span>
                            <span>•</span>
                            <span>Billing: {staff.financialDetails.bankName} (Acct: {staff.financialDetails.accountNumber}, Sort: {staff.financialDetails.sortCode})</span>
                          </div>
                        </div>

                        <div className="text-left md:text-right">
                          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Total Work Completed</p>
                          <div className="flex items-center gap-1.5 md:justify-end mt-0.5">
                            <span className="font-mono text-sm font-semibold text-slate-700">{formatDecimalHours(totalClockedHours)} Net</span>
                            <span className="text-slate-300">|</span>
                            <span className="font-mono text-base font-extrabold text-emerald-600">£{totalEarnedPay.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Worked shifts details */}
                      <div className="space-y-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Clock Audit Logs:</p>
                        {details.map(({ shift, log, clockedHours, earnedPay }) => {
                          const clockInStr = log.clockInTime ? new Date(log.clockInTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'N/A';
                          const clockOutStr = log.clockOutTime ? new Date(log.clockOutTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'N/A';
                          
                          // Calculate breaks duration
                          const breakSumMinutes = log.breaks.reduce((acc, curr) => {
                            if (curr.start && curr.end) {
                              return acc + (new Date(curr.end).getTime() - new Date(curr.start).getTime()) / (1000 * 60);
                            }
                            return acc;
                          }, 0);

                          const isEditing = editingLogId === log.id;

                          if (isEditing) {
                            return (
                              <div key={shift.id} className="bg-amber-50/50 border-2 border-amber-200 rounded-xl p-5 space-y-4 animate-fade-in text-slate-800">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div>
                                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest block">Editing Timesheet</span>
                                    <span className="font-bold text-slate-900 text-sm">{shift.locationName}</span>
                                    <span className="text-xs text-slate-500 block">{shift.date}</span>
                                  </div>
                                  <span className="text-xs font-mono font-semibold text-slate-500">
                                    Shift Budget: {shift.startTime} - {shift.endTime} (£{shift.payRatePerHour.toFixed(2)}/hr)
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* Clock In */}
                                  <div className="space-y-1 bg-white p-3 rounded-lg border border-slate-200">
                                    <label className="text-xs font-semibold text-slate-700 block">Clock-In Timestamp</label>
                                    <div className="grid grid-cols-2 gap-2 mt-1">
                                      <div>
                                        <span className="text-[9px] text-slate-400 block font-medium">Date</span>
                                        <input
                                          type="date"
                                          value={editInDate}
                                          onChange={(e) => setEditInDate(e.target.value)}
                                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-slate-800"
                                        />
                                      </div>
                                      <div>
                                        <span className="text-[9px] text-slate-400 block font-medium">Time</span>
                                        <input
                                          type="time"
                                          value={editInTime}
                                          onChange={(e) => setEditInTime(e.target.value)}
                                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-slate-800"
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  {/* Clock Out */}
                                  <div className="space-y-1 bg-white p-3 rounded-lg border border-slate-200">
                                    <label className="text-xs font-semibold text-slate-700 block">Clock-Out Timestamp</label>
                                    <div className="grid grid-cols-2 gap-2 mt-1">
                                      <div>
                                        <span className="text-[9px] text-slate-400 block font-medium">Date</span>
                                        <input
                                          type="date"
                                          value={editOutDate}
                                          onChange={(e) => setEditOutDate(e.target.value)}
                                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-slate-800"
                                        />
                                      </div>
                                      <div>
                                        <span className="text-[9px] text-slate-400 block font-medium">Time</span>
                                        <input
                                          type="time"
                                          value={editOutTime}
                                          onChange={(e) => setEditOutTime(e.target.value)}
                                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-slate-800"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Break log editing */}
                                <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                                      <Clock size={12} className="text-indigo-500" />
                                      Unpaid Breaks Logged
                                    </label>
                                    <button
                                      type="button"
                                      onClick={addEditBreakRow}
                                      className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold flex items-center gap-1 transition-all"
                                    >
                                      <Plus size={10} /> Add Break Row
                                    </button>
                                  </div>

                                  {editBreaks.length === 0 ? (
                                    <p className="text-[11px] text-slate-400 italic">No unpaid breaks recorded for this timesheet.</p>
                                  ) : (
                                    <div className="space-y-2">
                                      {editBreaks.map((eb, idx) => (
                                        <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-100">
                                          <span className="text-[10px] text-slate-400 font-bold">Break #{idx + 1}:</span>
                                          <div className="flex items-center gap-1.5 flex-1">
                                            <div>
                                              <span className="text-[8px] text-slate-400 block">Start</span>
                                              <input
                                                type="time"
                                                value={eb.startTime}
                                                onChange={(e) => updateEditBreak(idx, 'startTime', e.target.value)}
                                                className="px-2 py-0.5 text-xs border border-slate-200 rounded focus:outline-none"
                                              />
                                            </div>
                                            <span className="text-slate-400 text-xs mt-3">to</span>
                                            <div>
                                              <span className="text-[8px] text-slate-400 block">End</span>
                                              <input
                                                type="time"
                                                value={eb.endTime}
                                                onChange={(e) => updateEditBreak(idx, 'endTime', e.target.value)}
                                                className="px-2 py-0.5 text-xs border border-slate-200 rounded focus:outline-none"
                                              />
                                            </div>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => removeEditBreakRow(idx)}
                                            className="p-1.5 hover:bg-rose-50 text-rose-600 rounded transition-colors self-end mt-2"
                                            title="Delete break"
                                          >
                                            <X size={14} />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                  <button
                                    type="button"
                                    onClick={() => setEditingLogId(null)}
                                    className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 font-semibold border border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveTimesheet(log.id, shift, log.staffId)}
                                    className="px-3.5 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all shadow-sm flex items-center gap-1"
                                  >
                                    Save Timesheet
                                  </button>
                                </div>
                              </div>
                            );
                          }

                           return (
                            <div key={shift.id} className="bg-white border border-slate-100 rounded-lg p-4 flex flex-col gap-3">
                              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                                
                                <div className="md:col-span-3">
                                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Zone</span>
                                  <span className="font-semibold text-slate-900">{shift.locationName}</span>
                                  <span className="text-xs text-slate-500 block mt-0.5">{shift.date}</span>
                                </div>

                                <div className="md:col-span-4">
                                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Clock Timestamps</span>
                                  {log.clockInTime ? (
                                    <>
                                      <div className="text-xs font-mono font-semibold text-slate-700 flex items-center gap-1.5 mt-0.5">
                                        <span>IN: {clockInStr}</span>
                                        <ArrowRight size={12} className="text-slate-400" />
                                        {log.clockOutTime ? (
                                          <span>OUT: {clockOutStr}</span>
                                        ) : (
                                          <span className="text-amber-600 font-bold animate-pulse">ACTIVE NOW</span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-slate-400 mt-1 font-semibold">
                                        Breaks Registered: {log.breaks.length} ({Math.round(breakSumMinutes)}m unpaid breaks)
                                      </div>
                                    </>
                                  ) : (
                                    <span className="text-xs text-slate-400 italic block mt-1">No clock logs recorded yet</span>
                                  )}
                                </div>

                                {/* Mid Shift Moves */}
                                <div className="md:col-span-3">
                                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                                    <Footprints size={12} className="text-indigo-500" /> Mid-shift transfers
                                  </span>
                                  {log.locationLogs.length <= 1 ? (
                                    <span className="text-xs text-slate-400 italic">No transfers logged</span>
                                  ) : (
                                    <div className="space-y-1 mt-1 max-h-16 overflow-y-auto">
                                      {log.locationLogs.map((logItem, i) => (
                                        <div key={i} className="text-[10px] flex items-center gap-1 text-slate-600">
                                          <span className="font-semibold font-mono text-slate-400">
                                            {new Date(logItem.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                          <span className="truncate" title={logItem.locationName}>{logItem.locationName}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div className="md:col-span-2 text-left md:text-right bg-slate-50 md:bg-transparent p-2 md:p-1.5 rounded-lg flex flex-col justify-between md:items-end gap-2.5">
                                  <div className="w-full">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Completed Pay</span>
                                    {log.clockInTime && log.clockOutTime ? (
                                      <>
                                        <span className="font-mono text-xs text-slate-500 block">{clockedHours.toFixed(2)} hrs @ £{shift.payRatePerHour.toFixed(2)}</span>
                                        <span className="font-mono text-sm font-bold text-emerald-600 block mt-0.5">£{earnedPay.toFixed(2)}</span>
                                      </>
                                    ) : log.clockInTime ? (
                                      <span className="text-[11px] text-amber-600 font-bold block mt-0.5">Shift Active</span>
                                    ) : (
                                      <span className="text-[11px] text-slate-400 italic block mt-0.5">No Clock Log</span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => startEditingLog(log, shift)}
                                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer border border-slate-200/50"
                                  >
                                    <Edit size={11} /> Edit Timesheet
                                  </button>
                                </div>
                              </div>

                              {/* Staff Feedback Questionnaire response */}
                              {log.feedbackRating ? (
                                <div className="mt-1 p-3 bg-slate-50/70 border border-slate-100/60 rounded-xl space-y-2 text-xs">
                                  <div className="flex items-center justify-between flex-wrap gap-2">
                                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                                      💬 Staff Shift Feedback
                                    </span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] text-slate-400 font-bold">Rating:</span>
                                      <div className="flex">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                          <Star
                                            key={star}
                                            size={11}
                                            className={star <= (log.feedbackRating || 0) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}
                                          />
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                                    <div className="bg-white p-2 border border-slate-100 rounded-lg">
                                      <span className="text-[9px] text-slate-400 uppercase font-bold block">1. Early/Late/No Break Approval Notes:</span>
                                      <p className="text-slate-700 mt-0.5 font-semibold leading-relaxed italic">
                                        "{log.feedbackApproval || 'No deviations reported'}"
                                      </p>
                                    </div>
                                    
                                    <div className="bg-white p-2 border border-slate-100 rounded-lg">
                                      <span className="text-[9px] text-slate-400 uppercase font-bold block">2. Improvement suggestions:</span>
                                      <p className="text-slate-700 mt-0.5 font-semibold leading-relaxed italic">
                                        {log.feedbackImprovement ? `"${log.feedbackImprovement}"` : 'None shared.'}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ) : log.clockOutTime ? (
                                <div className="text-[10px] text-slate-400 italic px-2">No feedback completed.</div>
                              ) : null}

                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Staff Directory & Status */}
      {activeTab === 'staff' && (
        <div className="space-y-6 animate-fade-in" id="staff-tab">
          
          {/* Google Workspace Integration Control Center */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className={`p-2 rounded-xl flex items-center justify-center ${googleToken ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  <Layers size={18} />
                </span>
                <div>
                  <h3 className="font-bold text-slate-950 text-sm">Google Workspace Integration</h3>
                  <p className="text-xs text-slate-500 font-medium">Automate invitations via Gmail API and back up shift logs via Google Sheets API</p>
                </div>
              </div>
              
              {onGoogleConnect && (
                <div className="flex items-center gap-2">
                  {googleToken ? (
                    <>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200/50">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Workspace Active
                      </span>
                      {onGoogleDisconnect && (
                        <button
                          type="button"
                          onClick={onGoogleDisconnect}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95"
                        >
                          Disconnect
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-lg border border-amber-200/50 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Not Connected
                      </span>
                      <button
                        type="button"
                        onClick={onGoogleConnect}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm shadow-indigo-600/10 active:scale-95"
                      >
                        <CloudLightning size={12} /> Connect Workspace
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold text-slate-600 leading-relaxed">
              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5">
                <span className="text-slate-900 font-bold block text-xs">✉️ Gmail Delivery</span>
                <p className="text-slate-500 font-medium text-[11px]">
                  When connected, onboarding invite emails and shift notification emails are automatically dispatched via your actual Gmail/Google Workspace account, ensuring high-deliverability inbox placement.
                </p>
              </div>
              
              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5">
                <span className="text-slate-900 font-bold block text-xs">📊 Google Sheets Live Backup</span>
                {backupSpreadsheetId ? (
                  <div className="space-y-1">
                    <p className="text-slate-500 font-medium text-[11px]">
                      Your shifts database is being backed up in real-time to Google Sheets:
                    </p>
                    <a 
                      href={`https://docs.google.com/spreadsheets/d/${backupSpreadsheetId}/edit`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-indigo-600 hover:text-indigo-700 flex items-center gap-1 mt-1 underline decoration-indigo-300 font-bold text-[11px]"
                    >
                      Open Backup Spreadsheet <ExternalLink size={10} />
                    </a>
                  </div>
                ) : (
                  <p className="text-slate-500 font-medium text-[11px]">
                    When connected, a master backup spreadsheet will be automatically created in your Google Drive to log and sync all staff hours, timesheets, and ratings securely.
                  </p>
                )}
              </div>
            </div>
          </div>
          
          {/* Top Row: Add Staff & Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Add Staff Members form */}
            <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                  <UserPlus size={18} />
                </span>
                <div>
                  <h3 className="font-bold text-slate-950 text-sm">Add Staff Members</h3>
                  <p className="text-xs text-slate-500 font-medium">Send onboarding setup instructions via email</p>
                </div>
              </div>

              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (onInviteStaffEmail && inviteEmail.trim()) {
                    onInviteStaffEmail(inviteEmail);
                    setInviteEmail('');
                  }
                }}
                className="mt-4 space-y-4"
              >
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 block">Staff Email Address</label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      required
                      placeholder="e.g. name@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-semibold"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm shadow-indigo-600/10"
                    >
                      <Mail size={14} /> Send Link
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                  This will generate a secure onboarding link. The candidate can use it to input personal, financial/payout, emergency contacts, and sign the Code of Conduct before being assigned any shifts.
                </p>
              </form>
            </div>

            {/* Quick Metrics */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div className="space-y-4">
                <h3 className="font-bold text-slate-950 text-xs uppercase tracking-wider text-slate-400">Directory Quick Stats</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-slate-400 text-[10px] font-bold block uppercase">Registered</span>
                    <span className="text-slate-900 font-extrabold text-xl font-mono">{staffProfiles.length}</span>
                  </div>
                  <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50">
                    <span className="text-indigo-600 text-[10px] font-bold block uppercase">Invitations</span>
                    <span className="text-indigo-950 font-extrabold text-xl font-mono">
                      {invitations.filter(i => i.status === 'invited').length}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 font-medium leading-relaxed bg-amber-50/50 border border-amber-100/60 p-3 rounded-xl mt-3 flex items-start gap-1.5">
                <ShieldAlert size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <span>Only authorized Coordinators can access sensitive medical records, banking payout files, and Code of Conduct signatures. All lookups are tracked.</span>
              </div>
            </div>
          </div>

          {/* Pending Invitations list */}
          {invitations.length > 0 && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3">Pending Sent Invitations</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {invitations.map((inv, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-semibold text-slate-700">
                    <div className="space-y-0.5 min-w-0">
                      <span className="text-slate-900 font-mono truncate block" title={inv.email}>{inv.email}</span>
                      <span className="text-[10px] text-slate-400 font-medium">Invited: {new Date(inv.invitedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                      {inv.status === 'registered' ? (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] rounded-md font-extrabold uppercase">Registered</span>
                      ) : (
                        <>
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] rounded-md font-extrabold uppercase animate-pulse">Invited</span>
                          {onResendInvitation && (
                            <button
                              onClick={() => onResendInvitation(inv.email)}
                              className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors cursor-pointer flex items-center gap-1 active:scale-95"
                              title="Resend invitation link"
                            >
                              <Mail size={12} />
                              <span className="text-[10px] font-bold">Resend</span>
                            </button>
                          )}
                          {onDeleteInvitation && (
                            <button
                              onClick={() => onDeleteInvitation(inv.email)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors cursor-pointer flex items-center gap-1 active:scale-95"
                              title="Delete / cancel invitation"
                            >
                              <Trash2 size={12} />
                              <span className="text-[10px] font-bold">Cancel</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Registered Staff Database Table/Cards */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
            <h4 className="font-bold text-slate-900 text-sm">Registered Profiles Directory</h4>
            
            <div className="space-y-3">
              {staffProfiles.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">No registered staff found.</div>
              ) : (
                staffProfiles.map((p) => {
                  const isExpanded = expandedStaffId === p.id;
                  
                  return (
                    <div key={p.id} className="border border-slate-105 rounded-2xl overflow-hidden shadow-2xs hover:border-slate-200 transition-all">
                      
                      {/* Row view */}
                      <div className="p-4 bg-slate-50/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-slate-200 text-slate-700 rounded-xl flex items-center justify-center font-bold text-sm">
                            {(p.fullName || 'Anonymous').split(' ').filter(Boolean).map(n => n[0]).join('')}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h5 className="font-bold text-slate-950 text-sm">{p.fullName || 'Anonymous'}</h5>
                              {p.preferredName && p.preferredName !== p.fullName && (
                                <span className="text-xs text-slate-500 font-medium">({p.preferredName})</span>
                              )}
                              {p.pronouns && (
                                <span className="text-[10px] text-slate-400 font-bold px-1.5 py-0.2 bg-slate-100 rounded">
                                  {p.pronouns}
                                </span>
                              )}
                              {p.role === 'admin' && (
                                <span className="text-[10px] font-extrabold bg-slate-900 text-white px-1.5 py-0.2 rounded uppercase tracking-wider">
                                  Coordinator
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                              <span className="font-mono">{p.email}</span>
                              <span className="text-slate-300">•</span>
                              <span className="font-mono">{p.phoneNumber}</span>
                            </div>
                          </div>
                        </div>

                        {/* Status elements & Quick triggers */}
                        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                          <div className="flex items-center gap-2">
                            {/* Code of Conduct Sign indicator */}
                            {p.codeOfConductSigned ? (
                              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-extrabold rounded-md flex items-center gap-1" title={`Signed: ${p.codeOfConductSignedAt}`}>
                                <Check size={11} /> Conduct Signed
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-rose-50 text-rose-700 text-[10px] font-extrabold rounded-md flex items-center gap-1">
                                <X size={11} /> Unsigned Conduct
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Expand Profile Details Button */}
                            <button
                              type="button"
                              onClick={() => setExpandedStaffId(isExpanded ? null : p.id)}
                              className="px-3 py-1.5 hover:bg-slate-100 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-bold transition-all cursor-pointer border border-slate-200/60"
                            >
                              {isExpanded ? 'Hide Details' : 'View Full Profile'}
                            </button>

                            {/* Promote / Demote Role Toggle */}
                            {onUpdateStaffRole && (
                              <button
                                type="button"
                                onClick={() => onUpdateStaffRole(p.id, p.role === 'admin' ? 'staff' : 'admin')}
                                title={p.role === 'admin' ? 'Demote coordinator' : 'Promote to admin / coordinator'}
                                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                  p.role === 'admin' 
                                    ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' 
                                    : 'bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100'
                                }`}
                              >
                                <Shield size={14} />
                              </button>
                            )}

                            {/* Delete Button */}
                            {onDeleteStaff && (
                              <button
                                type="button"
                                onClick={() => onDeleteStaff(p.id)}
                                title="Delete staff profile"
                                className="p-1.5 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 rounded-lg transition-all cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expanded View */}
                      {isExpanded && (
                        <div className="p-5 border-t border-slate-100 bg-white grid grid-cols-1 md:grid-cols-3 gap-6">
                          
                          {/* Left Column: Bank payout */}
                          <div className="space-y-2 p-4 bg-slate-50/70 border border-slate-100 rounded-2xl">
                            <h6 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                              💳 Billing & Payout Information
                            </h6>
                            <div className="space-y-1.5 text-xs text-slate-700 font-semibold">
                              <div className="flex justify-between">
                                <span className="text-slate-400 font-medium">Bank Name:</span>
                                <span>{p.financialDetails?.bankName || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400 font-medium">Account Name:</span>
                                <span className="truncate max-w-[140px]" title={p.financialDetails?.nameOnAccount}>{p.financialDetails?.nameOnAccount || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400 font-medium">Sort Code:</span>
                                <span className="font-mono">{p.financialDetails?.sortCode || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400 font-medium">Account Number:</span>
                                <span className="font-mono">{p.financialDetails?.accountNumber || 'N/A'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Center Column: Emergency contacts & Address */}
                          <div className="space-y-2 p-4 bg-slate-50/70 border border-slate-100 rounded-2xl">
                            <h6 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                              📞 Emergency Contact
                            </h6>
                            <div className="space-y-1.5 text-xs text-slate-700 font-semibold">
                              <div className="flex justify-between">
                                <span className="text-slate-400 font-medium">Contact:</span>
                                <span>{p.emergencyContact?.name || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400 font-medium">Relationship:</span>
                                <span>{p.emergencyContact?.relationship || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400 font-medium">Contact Phone:</span>
                                <span className="font-mono">{p.emergencyContact?.number || 'N/A'}</span>
                              </div>
                            </div>
                            <div className="pt-2 border-t border-slate-200/50">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Address</span>
                              <span className="text-xs text-slate-600 block leading-relaxed mt-0.5">{p.address || 'N/A'}</span>
                            </div>
                          </div>

                          {/* Right Column: Health & allergies */}
                          <div className="space-y-2 p-4 bg-slate-50/70 border border-slate-100 rounded-2xl flex flex-col justify-between">
                            <div className="space-y-2">
                              <h6 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                🩺 Medical Declarations
                              </h6>
                              <div className="space-y-1.5 text-xs">
                                <div>
                                  <span className="text-[10px] font-bold text-slate-400 uppercase">Pre-existing Conditions:</span>
                                  <p className="text-slate-700 leading-relaxed font-semibold">{p.medicalConditions || 'None'}</p>
                                </div>
                                <div>
                                  <span className="text-[10px] font-bold text-slate-400 uppercase">Serious Allergies:</span>
                                  <p className="text-slate-700 leading-relaxed font-semibold">{p.seriousAllergies || 'None'}</p>
                                </div>
                              </div>
                            </div>

                            {p.codeOfConductSigned && (
                              <div className="text-[10px] text-slate-400 font-medium border-t border-slate-200/50 pt-2 flex flex-col">
                                <span>Conduct Signature: <strong className="text-slate-700">"{p.codeOfConductSignature}"</strong></span>
                                <span>Signed: {new Date(p.codeOfConductSignedAt || '').toLocaleString()}</span>
                              </div>
                            )}
                          </div>

                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      )}

      {/* Tab 6: Invoices & Expenses Management */}
      {activeTab === 'invoices' && (
        <div className="space-y-6 animate-fade-in" id="admin-invoices-tab">
          
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                  <FileText className="text-indigo-600" size={18} />
                  Staff Invoice & Expense Auditing
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Review and process payroll timesheets and receipts submitted by festival staff.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl">
                  <span>Approved (Unpaid):</span>
                  <strong className="text-slate-900">
                    £{invoices.filter(inv => inv.status === 'approved').reduce((acc, curr) => acc + curr.grandTotal, 0).toFixed(2)}
                  </strong>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-xl">
                  <span>Pending Approval:</span>
                  <strong className="text-slate-900">
                    £{invoices.filter(inv => inv.status === 'pending').reduce((acc, curr) => acc + curr.grandTotal, 0).toFixed(2)}
                  </strong>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadOutstandingInvoices}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl shadow-md shadow-emerald-600/10 hover:shadow-emerald-600/20 active:scale-95 cursor-pointer flex items-center gap-1.5 transition-all"
                  title="Download all approved or pending invoices to share with accounts"
                >
                  <Download size={13} />
                  Download Unpaid Invoices
                </button>
              </div>
            </div>

            {/* Sorted Staff Directory with Invoices */}
            <div className="space-y-4">
              {(() => {
                const sortedStaffForInvoices = [...staffProfiles].sort((s1, s2) => {
                  const s1Invoices = invoices.filter(inv => inv.staffId === s1.id);
                  const s2Invoices = invoices.filter(inv => inv.staffId === s2.id);

                  const s1HasApprovedUnpaid = s1Invoices.some(inv => inv.status === 'approved');
                  const s2HasApprovedUnpaid = s2Invoices.some(inv => inv.status === 'approved');

                  const s1HasPending = s1Invoices.some(inv => inv.status === 'pending');
                  const s2HasPending = s2Invoices.some(inv => inv.status === 'pending');

                  const s1Score = s1HasApprovedUnpaid ? 0 : s1HasPending ? 1 : 2;
                  const s2Score = s2HasApprovedUnpaid ? 0 : s2HasPending ? 1 : 2;

                  if (s1Score !== s2Score) {
                    return s1Score - s2Score;
                  }
                  return s1.fullName.localeCompare(s2.fullName);
                });

                if (sortedStaffForInvoices.length === 0) {
                  return (
                    <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-xl space-y-2">
                      <FileText className="mx-auto text-slate-300" size={32} />
                      <p className="text-sm font-bold text-slate-600">No staff members found.</p>
                    </div>
                  );
                }

                return sortedStaffForInvoices.map((staff) => {
                  const staffInvoices = invoices.filter(inv => inv.staffId === staff.id);
                  const approvedUnpaidCount = staffInvoices.filter(inv => inv.status === 'approved').length;
                  const pendingCount = staffInvoices.filter(inv => inv.status === 'pending').length;

                  let categoryBadge = null;
                  if (approvedUnpaidCount > 0) {
                    categoryBadge = (
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-extrabold text-[9px] uppercase tracking-wider rounded-md border border-indigo-100">
                        Approved & Unpaid ({approvedUnpaidCount})
                      </span>
                    );
                  } else if (pendingCount > 0) {
                    categoryBadge = (
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-700 font-extrabold text-[9px] uppercase tracking-wider rounded-md border border-amber-100">
                        Waiting Approval ({pendingCount})
                      </span>
                    );
                  } else if (staffInvoices.length > 0) {
                    categoryBadge = (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-extrabold text-[9px] uppercase tracking-wider rounded-md">
                        All Paid / Settled
                      </span>
                    );
                  } else {
                    categoryBadge = (
                      <span className="px-2 py-0.5 bg-slate-50 text-slate-400 font-semibold text-[9px] uppercase tracking-wider rounded-md">
                        No Invoices
                      </span>
                    );
                  }

                  return (
                    <div key={staff.id} className="border border-slate-100 rounded-2xl overflow-hidden hover:border-slate-200 transition-all bg-slate-50/20 animate-fade-in">
                      
                      {/* Staff Header Row */}
                      <div className="p-4 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 bg-slate-900 text-white rounded-full font-bold flex items-center justify-center text-sm uppercase shrink-0">
                            {staff.fullName.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm">{staff.fullName}</h4>
                            <p className="text-slate-500 font-semibold">{staff.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 flex-wrap">
                          {categoryBadge}
                          <span className="text-[11px] text-slate-400 font-bold">Total Submissions: {staffInvoices.length}</span>
                        </div>
                      </div>

                      {/* Staff Invoices Sub-List */}
                      <div className="p-4 bg-white divide-y divide-slate-150">
                        {staffInvoices.length === 0 ? (
                          <div className="py-2 text-center text-slate-400 text-xs font-semibold">
                            This staff member has no submitted invoices.
                          </div>
                        ) : (
                          staffInvoices.map((inv) => {
                            const isExpanded = adminExpandedInvoiceId === inv.id;
                            return (
                              <div key={inv.id} className="py-4 first:pt-0 last:pb-0 space-y-4 animate-fade-in">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-800 text-sm">{inv.eventName}</span>
                                      <span className="text-[10px] text-slate-400 font-bold">
                                        Submitted {new Date(inv.createdAt).toLocaleDateString()}
                                      </span>
                                    </div>
                                    <div className="text-[11px] font-semibold text-slate-500 mt-0.5">
                                      Billing Name: {inv.financialDetails.nameOnAccount} | Account: {inv.financialDetails.accountNumber}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3">
                                    <div className="text-right">
                                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Grand Total</div>
                                      <div className="font-extrabold text-slate-900 text-sm">£{inv.grandTotal.toFixed(2)}</div>
                                    </div>

                                    {/* Actions */}
                                    {inv.status === 'pending' && (
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (onApproveInvoice && currentAdminProfile) {
                                              onApproveInvoice(inv.id, currentAdminProfile.id, currentAdminProfile.fullName);
                                            } else if (onApproveInvoice) {
                                              onApproveInvoice(inv.id, 'admin-demo', 'Festival Coordinator');
                                            }
                                          }}
                                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[11px] rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-sm"
                                        >
                                          <CheckCircle size={13} /> Approve
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setRejectInvoiceId(inv.id);
                                            setRejectionReason('');
                                          }}
                                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 font-extrabold text-[11px] rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                                        >
                                          <XCircle size={13} /> Not Approved
                                        </button>
                                      </div>
                                    )}

                                    {inv.status === 'approved' && (
                                      <div className="flex items-center gap-2">
                                        <span className="px-2 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-md font-extrabold text-[10px] uppercase tracking-wider">
                                          Approved
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (onMarkInvoiceAsPaid) {
                                              onMarkInvoiceAsPaid(inv.id);
                                            }
                                          }}
                                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11px] rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-sm"
                                        >
                                          <DollarSign size={13} /> Show as Paid
                                        </button>
                                      </div>
                                    )}

                                    {inv.status === 'paid' && (
                                      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1">
                                        <Check size={12} /> Paid
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Expanded details toggler */}
                                <div>
                                  <div className="flex flex-wrap items-center gap-4">
                                    <button
                                      type="button"
                                      onClick={() => setAdminExpandedInvoiceId(isExpanded ? null : inv.id)}
                                      className="text-xs text-indigo-600 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                                    >
                                      {isExpanded ? 'Hide Full Timesheet & Receipts ▲' : 'Expand Full Timesheet & Receipts ▼'}
                                    </button>
                                    <button
                                      type="button"
                                      id={`download-invoice-admin-${inv.id}`}
                                      onClick={() => downloadInvoice(inv)}
                                      className="text-xs text-emerald-600 hover:text-emerald-700 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                                    >
                                      <Download size={13} />
                                      Download Invoice PDF/HTML
                                    </button>
                                  </div>
                                </div>

                                {isExpanded && (
                                  <div className="p-4 bg-slate-50/50 rounded-xl space-y-4 text-xs font-semibold text-slate-700 border border-slate-100 animate-fade-in">
                                    
                                    {/* Contact & Banking row */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-slate-150 pb-3">
                                      <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Contact Details (At Submission)</span>
                                        <div className="space-y-1">
                                          <div>Legal Name: <strong className="text-slate-800">{inv.contactDetails.fullName}</strong></div>
                                          <div>Email: <strong className="text-slate-800">{inv.contactDetails.email}</strong></div>
                                          <div>Phone: <strong className="text-slate-800">{inv.contactDetails.phoneNumber}</strong></div>
                                          <div>Address: <strong className="text-slate-800">{inv.contactDetails.address}</strong></div>
                                        </div>
                                      </div>
                                      <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Financial Account Details</span>
                                        <div className="space-y-1">
                                          <div>Bank: <strong className="text-slate-800">{inv.financialDetails.bankName}</strong></div>
                                          <div>Account Name: <strong className="text-slate-800">{inv.financialDetails.nameOnAccount}</strong></div>
                                          <div>Sort Code: <strong className="text-slate-800 font-mono">{inv.financialDetails.sortCode}</strong></div>
                                          <div>Account Number: <strong className="text-slate-800 font-mono">{inv.financialDetails.accountNumber}</strong></div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Shifts audit */}
                                    <div>
                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Worked Shifts timesheet</span>
                                      <div className="space-y-1.5">
                                        {inv.shifts.map((s) => (
                                          <div key={s.shiftId} className="p-2.5 bg-white border border-slate-100 rounded-lg flex justify-between items-center gap-3">
                                            <div>
                                              <span className="font-bold text-slate-800 block">{s.locationName}</span>
                                              <span className="text-slate-500 text-[10px]">{s.date}</span>
                                            </div>
                                            <div className="text-right">
                                              <div className="text-slate-700 font-bold">{s.hours} hours @ £{s.rate}/hr</div>
                                              <div className="font-extrabold text-slate-900 text-[11px]">Total: £{s.total.toFixed(2)}</div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Expenses with Supporting Document attachments */}
                                    {inv.expenses.length > 0 && (
                                      <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Supporting Documents & Expenses</span>
                                        <div className="space-y-1.5">
                                          {inv.expenses.map((e) => (
                                            <div key={e.id} className="p-2.5 bg-white border border-slate-100 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
                                              <div>
                                                <span className="font-bold text-slate-800 block">{e.description}</span>
                                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded uppercase tracking-wider inline-block mt-0.5">Pre-agreed Expense</span>
                                              </div>
                                              <div className="flex items-center gap-4">
                                                {e.documentName && e.documentUrl && (
                                                  <a
                                                    href={e.documentUrl}
                                                    download={e.documentName}
                                                    className="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100 rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                                                  >
                                                    <FileText size={12} /> View Receipt Document ({e.documentName.length > 15 ? e.documentName.substring(0,12)+'...' : e.documentName})
                                                  </a>
                                                )}
                                                <div className="text-right font-extrabold text-slate-900 text-sm">
                                                  £{e.amount.toFixed(2)}
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Admin logs */}
                                    {inv.approvedByAdminName && (
                                      <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-lg text-[10px] text-slate-700 font-bold flex items-center gap-1.5">
                                        <CheckCircle size={14} className="text-indigo-600" />
                                        Approved & signed off by admin: <span className="text-slate-800 font-extrabold">{inv.approvedByAdminName}</span> (ID: {inv.approvedByAdminId})
                                      </div>
                                    )}

                                  </div>
                                )}

                              </div>
                            );
                          })
                        )}
                      </div>

                    </div>
                  );
                });
              })()}
            </div>

          </div>

        </div>
      )}

      {/* Rejection Modal */}
      {rejectInvoiceId && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="rejection-modal">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl p-6 space-y-4 text-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <ShieldAlert className="text-rose-600" size={18} />
                Reject & Request Invoice Resubmission
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Please add a note explaining why this invoice is not approved. The invoice will be removed, and the staff member will be emailed automatically to resubmit.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 block">Rejection Reason *</label>
              <textarea
                rows={3}
                required
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Please upload actual receipts rather than bank screenshots, or adjust hours on Sunday..."
                className="w-full p-3 text-xs bg-slate-5/50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-rose-500 font-medium"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setRejectInvoiceId(null);
                  setRejectionReason('');
                }}
                className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rejectionReason.trim()}
                onClick={() => {
                  if (onRejectInvoice && rejectInvoiceId) {
                    onRejectInvoice(rejectInvoiceId, rejectionReason.trim());
                  }
                  setRejectInvoiceId(null);
                  setRejectionReason('');
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-extrabold rounded-lg shadow-md shadow-rose-600/10 cursor-pointer"
              >
                Confirm Rejection & Email Staff
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift Editing Modal */}
      {editingShiftId && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="shift-edit-modal">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl p-6 space-y-4 text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                <span className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg"><Edit size={14} /></span>
                Edit Scheduled Shift
              </h3>
              <button
                type="button"
                onClick={() => setEditingShiftId(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs animate-slide-down">
              {/* Location selection */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 block">Sub-Location / Zone *</label>
                <select
                  value={editShiftLocation}
                  onChange={(e) => setEditShiftLocation(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-none cursor-pointer"
                >
                  {currentSelectedEvent?.locations.map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              {/* Date selection */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 block">Shift Date *</label>
                <input
                  type="date"
                  required
                  min={currentSelectedEvent?.startDate}
                  max={currentSelectedEvent?.endDate}
                  value={editShiftDate}
                  onChange={(e) => setEditShiftDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-none"
                />
              </div>

              {/* Start & End Times */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">Start Time</label>
                  <input
                    type="time"
                    required
                    value={editShiftStart}
                    onChange={(e) => setEditShiftStart(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">End Time</label>
                  <input
                    type="time"
                    required
                    value={editShiftEnd}
                    onChange={(e) => setEditShiftEnd(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              {/* Rates and Break */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-3.5 border border-slate-100 rounded-2xl text-slate-800">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">Rate Type</label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/60 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setEditShiftRateType('hourly')}
                      className={`py-1 text-[10px] font-black uppercase rounded-lg transition-all cursor-pointer ${
                        editShiftRateType === 'hourly'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Hourly
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditShiftRateType('day')}
                      className={`py-1 text-[10px] font-black uppercase rounded-lg transition-all cursor-pointer ${
                        editShiftRateType === 'day'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Flat Day
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">
                    {editShiftRateType === 'hourly' ? 'Hourly Rate (£)' : 'Day Rate (£)'}
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={editShiftPayRate}
                    onChange={(e) => setEditShiftPayRate(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-none font-bold text-slate-800"
                  />
                </div>

                {editShiftRateType === 'hourly' && (
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-xs font-bold text-slate-600 block">Unpaid Break (mins)</label>
                    <input
                      type="number"
                      min="0"
                      step="5"
                      required
                      value={editShiftUnpaidBreak}
                      onChange={(e) => setEditShiftUnpaidBreak(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-none text-slate-800"
                    />
                  </div>
                )}
              </div>

              {/* Staff Allocation directly inside Shift Editor */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 block">Allocated Staff</label>
                <select
                  value={editShiftAllocateStaffId}
                  onChange={(e) => setEditShiftAllocateStaffId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="unallocated">-- Unallocated / Open Slot --</option>
                  {staffProfiles
                    .filter((p) => p.role === 'staff')
                    .map((p) => {
                      const hasSigned = p.codeOfConductSigned;
                      return (
                        <option 
                          key={p.id} 
                          value={p.id} 
                          disabled={!hasSigned}
                        >
                          {p.preferredName} {hasSigned ? '' : '⚠️ (Conduct Pending)'}
                        </option>
                      );
                    })}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setEditingShiftId(null)}
                className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveShiftEdits}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl shadow-md shadow-indigo-600/10 cursor-pointer"
              >
                Save Shift Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Rota Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in no-print" id="print-rota-modal">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col text-slate-800">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 p-6 shrink-0">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                  <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg"><Printer size={14} /></span>
                  Print Rota / Schedule View
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Rates are hidden automatically. Use this layout to print or save as a PDF.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-600/10 cursor-pointer flex items-center gap-1.5 transition-colors"
                >
                  <Printer size={13} />
                  Print Schedule
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Content / Preview Container */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
              {/* This is the container that gets styled by @media print */}
              <div className="printable-rota-area bg-white border border-slate-150 p-8 rounded-2xl shadow-xs space-y-6">
                
                {/* Printout Header */}
                <div className="border-b border-slate-200 pb-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight">🎪 Savour Food Festival - Staff Rota</h1>
                    <p className="text-sm font-extrabold text-indigo-600 mt-1">{currentSelectedEvent?.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5 font-semibold">Location: {currentSelectedEvent?.location}</p>
                  </div>
                  <div className="text-left md:text-right font-semibold text-xs text-slate-500">
                    <div>Printed: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                    <div className="mt-0.5">Event Dates: {currentSelectedEvent?.startDate} to {currentSelectedEvent?.endDate}</div>
                  </div>
                </div>

                {/* Printable Rota Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-300 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 pr-3">Date</th>
                        <th className="py-2.5 px-3">Location / Zone</th>
                        <th className="py-2.5 px-3">Timings</th>
                        <th className="py-2.5 px-3">Break</th>
                        <th className="py-2.5 px-3">Staff Assignment</th>
                        <th className="py-2.5 pl-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {currentEventShifts.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-slate-400 italic">No shifts built yet for this festival.</td>
                        </tr>
                      ) : (
                        currentEventShifts
                          .sort((a, b) => {
                            if (a.date !== b.date) return a.date.localeCompare(b.date);
                            if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
                            return a.locationName.localeCompare(b.locationName);
                          })
                          .map((shift) => {
                            const staff = staffProfiles.find((p) => p.id === shift.allocatedStaffId);
                            const dateFormatted = new Date(shift.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
                            
                            return (
                              <tr key={shift.id} className="text-slate-800 hover:bg-slate-50/50">
                                <td className="py-3 pr-3 font-bold">{dateFormatted}</td>
                                <td className="py-3 px-3 font-semibold text-slate-900">{shift.locationName}</td>
                                <td className="py-3 px-3 font-mono">{shift.startTime} - {shift.endTime}</td>
                                <td className="py-3 px-3 text-slate-500">
                                  {shift.unpaidBreakMinutes > 0 ? `${shift.unpaidBreakMinutes}m unpaid` : 'No break'}
                                </td>
                                <td className="py-3 px-3">
                                  {staff ? (
                                    <div>
                                      <span className="font-bold text-slate-900">{staff.preferredName}</span>
                                      <span className="text-slate-500 block text-[10px] mt-0.5 font-mono">{staff.fullName} | {staff.phoneNumber}</span>
                                    </div>
                                  ) : (
                                    <span className="text-amber-600 font-bold italic">Unallocated / Open Slot</span>
                                  )}
                                </td>
                                <td className="py-3 pl-3 text-right font-bold uppercase text-[9px] tracking-wider">
                                  {staff ? (
                                    <span className={
                                      shift.status === 'accepted' ? 'text-emerald-700' :
                                      shift.status === 'pending' ? 'text-amber-700 animate-pulse' :
                                      'text-rose-700'
                                    }>
                                      {shift.status}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">Open</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Printout Footer */}
                <div className="pt-5 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400 font-medium">
                  <div>Savour Staff Management Portal</div>
                  <div>Page 1 of 1</div>
                </div>

              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="border-t border-slate-100 p-4 bg-white flex justify-end gap-3 text-xs shrink-0">
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                Close Preview
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl shadow-md shadow-indigo-600/10 cursor-pointer flex items-center gap-1.5"
              >
                <Printer size={13} />
                Print Rota Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

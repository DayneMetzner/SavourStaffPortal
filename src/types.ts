/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface FinancialDetails {
  nameOnAccount: string;
  sortCode: string;
  accountNumber: string;
  bankName: string;
}

export interface EmergencyContact {
  name: string;
  number: string;
  relationship: string;
}

export interface StaffProfile {
  id: string;
  fullName: string;
  preferredName: string;
  phoneNumber: string;
  email: string;
  pronouns: string;
  address: string;
  financialDetails: FinancialDetails;
  emergencyContact: EmergencyContact;
  medicalConditions: string;
  seriousAllergies: string;
  codeOfConductSigned: boolean;
  codeOfConductSignedAt?: string;
  codeOfConductSignature?: string;
  role: 'admin' | 'staff';
  createdAt: string;
}

export interface FestivalEvent {
  id: string;
  name: string;
  location: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  locations: string[]; // List of sub-locations (e.g. 'Main Stage', 'VIP Bar')
}

export interface Shift {
  id: string;
  eventId: string;
  locationName: string; // sub-location
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  allocatedStaffId: string | null;
  status: 'pending' | 'accepted' | 'denied';
  unpaidBreakMinutes: number; // e.g. 30, 45, 60
  payRatePerHour: number; // hidden from staff until allocated or represents day rate if rateType is 'day'
  rateType?: 'hourly' | 'day';
}

export interface Invitation {
  email: string;
  invitedAt: string;
  status: 'invited' | 'registered';
}

export interface BreakLog {
  start: string; // ISO timestamp
  end: string | null; // ISO timestamp, null if active
}

export interface LocationChangeLog {
  locationName: string;
  timestamp: string; // ISO timestamp
}

export interface TimeLog {
  id: string;
  shiftId: string;
  staffId: string;
  clockInTime: string | null; // ISO timestamp
  clockOutTime: string | null; // ISO timestamp
  breaks: BreakLog[];
  locationLogs: LocationChangeLog[];
  feedbackApproval?: string; // - did you start early, finish late or not have a break? if so who was this approved by
  feedbackRating?: number; // - How was your shift (out of 5 stars)
  feedbackImprovement?: string; // - How can we improve your experience at our festival?
}

export interface InvoiceShift {
  shiftId: string;
  date: string;
  locationName: string;
  hours: number;
  rate: number;
  total: number;
}

export interface InvoiceExpense {
  id: string;
  description: string;
  amount: number;
  documentName: string;
  documentUrl: string; // base64 representation or data URL
}

export interface Invoice {
  id: string;
  staffId: string;
  staffName: string;
  eventId: string;
  eventName: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'not_approved' | 'paid';
  contactDetails: {
    fullName: string;
    email: string;
    phoneNumber: string;
    address: string;
  };
  financialDetails: FinancialDetails;
  shifts: InvoiceShift[];
  expenses: InvoiceExpense[];
  totalShiftsAmount: number;
  totalExpensesAmount: number;
  grandTotal: number;
  approvedByAdminId?: string;
  approvedByAdminName?: string;
  approvedAt?: string;
  rejectionReason?: string;
  paidAt?: string;
}


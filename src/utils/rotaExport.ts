/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FestivalEvent, Shift, StaffProfile } from '../types';

/**
 * Generates and triggers browser download of the Event Rota in CSV format
 */
export function downloadRotaCSV(
  event: FestivalEvent,
  shifts: Shift[],
  staffProfiles: StaffProfile[]
) {
  const eventShifts = shifts.filter((s) => s.eventId === event.id);
  
  // Headers
  const csvRows = [
    [
      'Shift ID',
      'Date',
      'Location / Zone',
      'Start Time',
      'End Time',
      'Allocated Staff Name',
      'Allocated Staff Email',
      'Allocation Status',
      'Unpaid Break (mins)',
      'Pay Rate',
      'Rate Type'
    ].map(quoteValue).join(',')
  ];

  // Shift rows
  eventShifts.forEach((shift) => {
    const staff = shift.allocatedStaffId 
      ? staffProfiles.find((p) => p.id === shift.allocatedStaffId)
      : null;

    const row = [
      shift.id,
      shift.date,
      shift.locationName,
      shift.startTime,
      shift.endTime,
      staff ? staff.fullName : 'UNALLOCATED',
      staff ? staff.email : 'N/A',
      shift.status.toUpperCase(),
      shift.unpaidBreakMinutes.toString(),
      `£${shift.payRatePerHour}`,
      shift.rateType || 'hourly'
    ];

    csvRows.push(row.map(quoteValue).join(','));
  });

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + csvRows.join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `Savour_Rota_${event.name.replace(/\s+/g, '_')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function quoteValue(val: string): string {
  const escaped = val.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Generates and triggers browser download of the Event Rota in a printable HTML Rota layout
 */
export function downloadRotaHTML(
  event: FestivalEvent,
  shifts: Shift[],
  staffProfiles: StaffProfile[]
) {
  const eventShifts = [...shifts.filter((s) => s.eventId === event.id)].sort((a, b) => {
    // Sort by Date, then by Start Time
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startTime.localeCompare(b.startTime);
  });

  const totalShiftsCount = eventShifts.length;
  const allocatedShiftsCount = eventShifts.filter((s) => s.allocatedStaffId).length;
  const unallocatedShiftsCount = totalShiftsCount - allocatedShiftsCount;

  // Format date helper
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const shiftRowsHtml = eventShifts.map((shift, idx) => {
    const staff = shift.allocatedStaffId
      ? staffProfiles.find((p) => p.id === shift.allocatedStaffId)
      : null;

    let statusBadgeColor = 'color: #94a3b8; background-color: #f1f5f9; border: 1px solid #e2e8f0;'; // Unallocated
    if (shift.allocatedStaffId) {
      statusBadgeColor = shift.status === 'accepted'
        ? 'color: #10b981; background-color: #ecfdf5; border: 1px solid #a7f3d0;' // Accepted
        : 'color: #f59e0b; background-color: #fffbeb; border: 1px solid #fde68a;'; // Pending
    }

    const statusText = shift.allocatedStaffId
      ? (shift.status === 'accepted' ? 'CONFIRMED' : 'PENDING ACCEPT')
      : 'OPEN / UNALLOCATED';

    const staffName = staff ? staff.fullName : '<span style="color: #cbd5e1; font-style: italic;">No staff assigned</span>';
    const staffEmail = staff ? staff.email : '-';

    return `
      <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
        <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #1e293b;">${formatDate(shift.date)}</td>
        <td style="padding: 12px 16px; font-size: 13px; color: #334155; font-weight: 500;">${shift.locationName}</td>
        <td style="padding: 12px 16px; font-size: 13px; font-family: monospace; color: #1e293b;">${shift.startTime} - ${shift.endTime}</td>
        <td style="padding: 12px 16px; font-size: 13px; color: #0f172a; font-weight: 600;">${staffName}</td>
        <td style="padding: 12px 16px; font-size: 12px; color: #64748b;">${staffEmail}</td>
        <td style="padding: 12px 16px; text-align: center;">
          <span style="display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; ${statusBadgeColor}">
            ${statusText}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  // Group allocations by staff
  const staffAllocMap: { [staffId: string]: { staff: StaffProfile; shifts: Shift[] } } = {};
  eventShifts.forEach((s) => {
    if (s.allocatedStaffId) {
      const staff = staffProfiles.find((p) => p.id === s.allocatedStaffId);
      if (staff) {
        if (!staffAllocMap[staff.id]) {
          staffAllocMap[staff.id] = { staff, shifts: [] };
        }
        staffAllocMap[staff.id].shifts.push(s);
      }
    }
  });

  const staffSummaryRowsHtml = Object.values(staffAllocMap).map(({ staff, shifts: sList }) => {
    const shiftDetailsStr = sList.map(s => `${s.date} [${s.startTime}-${s.endTime} at ${s.locationName}]`).join('<br/>');
    return `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 12px 16px; font-size: 13px; font-weight: 700; color: #1e293b; width: 30%;">${staff.fullName}</td>
        <td style="padding: 12px 16px; font-size: 12px; color: #64748b; width: 25%;">${staff.email}</td>
        <td style="padding: 12px 16px; font-size: 12px; color: #475569; font-weight: 500; width: 15%; text-align: center;">${sList.length} Shifts</td>
        <td style="padding: 12px 16px; font-size: 12px; color: #334155; line-height: 1.4; width: 30%;">${shiftDetailsStr}</td>
      </tr>
    `;
  }).join('');

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Savour Festival Rota - ${event.name}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 40px;
      line-height: 1.5;
      background-color: #f1f5f9;
    }

    .page-wrapper {
      max-width: 1000px;
      margin: 0 auto;
    }

    .rota-container {
      background-color: #ffffff;
      padding: 40px 32px;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
    }

    /* Print utility bar styling */
    .print-bar {
      background-color: #0f172a;
      padding: 12px 24px;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    }

    .print-bar span {
      color: #94a3b8;
      font-size: 13px;
      font-weight: 500;
    }

    .print-bar-btn {
      padding: 8px 16px;
      font-size: 12px;
      font-weight: 700;
      border-radius: 6px;
      cursor: pointer;
      border: none;
      transition: all 0.1s ease;
    }

    .btn-print {
      background-color: #4f46e5;
      color: #ffffff;
    }

    .btn-print:hover {
      background-color: #4338ca;
    }

    .btn-close {
      background-color: #475569;
      color: #f8fafc;
    }

    .btn-close:hover {
      background-color: #334155;
    }

    @media print {
      body {
        background-color: #ffffff !important;
        padding: 0 !important;
      }
      .rota-container {
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
      }
      .print-bar {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="page-wrapper">
    <div class="print-bar">
      <span>🎪 Rota Print Preview for <strong>${event.name}</strong></span>
      <div style="display: flex; gap: 8px;">
        <button class="print-bar-btn btn-print" onclick="window.print()">Print or Export PDF</button>
        <button class="print-bar-btn btn-close" onclick="window.close()">Close Preview</button>
      </div>
    </div>

    <div class="rota-container">
      <!-- Header -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 32px;">🎪</span>
              <div>
                <h1 style="margin: 0; font-size: 24px; font-weight: 800; tracking-tight: -0.5px; color: #0f172a;">Savour Food Festival</h1>
                <p style="margin: 2px 0 0 0; font-size: 13px; color: #64748b; font-weight: 600;">Shift Rota &amp; Staffing Schedule</p>
              </div>
            </div>
          </td>
          <td style="text-align: right; vertical-align: top;">
            <div style="font-size: 13px; color: #475569;">
              <p style="margin: 0; font-weight: 700; color: #0f172a;">Event: ${event.name}</p>
              <p style="margin: 4px 0 0 0;">Venue Location: <strong>${event.location}</strong></p>
              <p style="margin: 4px 0 0 0;">Dates: ${formatDate(event.startDate)} - ${formatDate(event.endDate)}</p>
            </div>
          </td>
        </tr>
      </table>

      <!-- Statistics Summary Cards -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 35px;">
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center;">
          <span style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 4px;">Total Budgeted Shifts</span>
          <span style="font-size: 24px; font-weight: 800; color: #1e293b;">${totalShiftsCount}</span>
        </div>
        <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px; text-align: center;">
          <span style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #065f46; margin-bottom: 4px;">Allocated Shifts</span>
          <span style="font-size: 24px; font-weight: 800; color: #047857;">${allocatedShiftsCount} / ${totalShiftsCount}</span>
        </div>
        <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; text-align: center;">
          <span style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #92400e; margin-bottom: 4px;">Unallocated Shifts</span>
          <span style="font-size: 24px; font-weight: 800; color: #b45309;">${unallocatedShiftsCount}</span>
        </div>
      </div>

      <!-- Tabular Chronological Shift Schedule -->
      <h3 style="font-size: 16px; font-weight: 800; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
        📅 Chronological Rota Schedule
      </h3>
      <table style="width: 100%; border-collapse: collapse; text-align: left; margin-bottom: 40px;">
        <thead>
          <tr style="background-color: #0f172a; color: #ffffff;">
            <th style="padding: 12px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; border-top-left-radius: 6px;">Date</th>
            <th style="padding: 12px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase;">Zone / Sub-Location</th>
            <th style="padding: 12px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase;">Time Slot</th>
            <th style="padding: 12px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase;">Allocated Staff Member</th>
            <th style="padding: 12px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase;">Staff Contact</th>
            <th style="padding: 12px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; text-align: center; border-top-right-radius: 6px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${shiftRowsHtml || `<tr><td colspan="6" style="padding: 24px; text-align: center; color: #94a3b8; font-style: italic; font-weight: 500;">No shifts scheduled for this event.</td></tr>`}
        </tbody>
      </table>

      <!-- Staff Member Allocation Summary Table -->
      <h3 style="font-size: 16px; font-weight: 800; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 16px;">
        👤 Staff Allocation Summary ({${Object.keys(staffAllocMap).length}} Active Staff)
      </h3>
      <table style="width: 100%; border-collapse: collapse; text-align: left;">
        <thead>
          <tr style="background-color: #334155; color: #ffffff;">
            <th style="padding: 12px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; border-top-left-radius: 6px;">Staff Member Name</th>
            <th style="padding: 12px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase;">Staff Contact Email</th>
            <th style="padding: 12px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; text-align: center;">Assigned Count</th>
            <th style="padding: 12px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; border-top-right-radius: 6px;">Shift Assignment Details</th>
          </tr>
        </thead>
        <tbody>
          ${staffSummaryRowsHtml || `<tr><td colspan="4" style="padding: 24px; text-align: center; color: #94a3b8; font-style: italic; font-weight: 500;">No staff members are allocated yet.</td></tr>`}
        </tbody>
      </table>

      <!-- Confidential Footer -->
      <div style="margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 10px; color: #94a3b8; text-align: center; font-weight: 600;">
        SAVOUR FESTIVAL CONFIDENTIAL SHIFT LOG &bull; PRINTED ON UTC TIMEZONE
      </div>
    </div>
  </div>
</body>
</html>`;

  const newWindow = window.open('', '_blank');
  if (newWindow) {
    newWindow.document.write(htmlContent);
    newWindow.document.close();
  } else {
    alert('Failed to open Print Preview. Please allow popups for this portal.');
  }
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TimeLog, Shift } from '../types';

/**
 * Calculates the total duration of breaks in minutes
 */
export function calculateBreakMinutes(breaks: TimeLog['breaks']): number {
  let totalMs = 0;
  for (const b of breaks) {
    if (b.start) {
      const end = b.end ? new Date(b.end) : new Date();
      totalMs += end.getTime() - new Date(b.start).getTime();
    }
  }
  return Math.round(totalMs / 60000);
}

/**
 * Calculates total worked hours excluding break duration
 */
export function calculateWorkedHours(
  clockIn: string | null,
  clockOut: string | null,
  breaks: TimeLog['breaks']
): number {
  if (!clockIn) return 0;
  const start = new Date(clockIn);
  const end = clockOut ? new Date(clockOut) : new Date();
  const diffMs = end.getTime() - start.getTime();
  const breakMs = calculateBreakMinutes(breaks) * 60000;
  const workedMs = Math.max(0, diffMs - breakMs);
  return Number((workedMs / 3600000).toFixed(2));
}

/**
 * Formats a break list for display
 */
export function formatBreaksList(breaks: TimeLog['breaks']): string {
  if (breaks.length === 0) return 'No unpaid breaks taken';
  return breaks.map((b, index) => {
    const startStr = new Date(b.start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const endStr = b.end 
      ? new Date(b.end).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : 'Active';
    const duration = b.end
      ? `${Math.round((new Date(b.end).getTime() - new Date(b.start).getTime()) / 60000)}m`
      : 'Active';
    return `Break #${index + 1}: ${startStr} - ${endStr} (${duration})`;
  }).join(', ');
}

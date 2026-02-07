/**
 * Chinese mainland working-day utilities.
 *
 * Powered by `chinese-days` package which includes official State Council
 * holiday schedules with 调休 (in-lieu workday) support.
 * Data updates come from package upgrades — no manual maintenance needed.
 */

import { isWorkday as _isWorkday } from 'chinese-days';

function fmtDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Check if a specific date is a non-working day in mainland China (holidays + weekends, excluding 调休). */
export function isNonWorkingDay(year: number, month: number, day: number): boolean {
  return !_isWorkday(fmtDate(year, month, day));
}

/** Check if a specific date is a Saturday or Sunday (regardless of 调休). */
export function isWeekend(year: number, month: number, day: number): boolean {
  const dow = new Date(year, month - 1, day).getDay();
  return dow === 0 || dow === 6;
}

/** Array of booleans for each day of a month: true if non-working day. */
export function getMonthNonWorkingDays(year: number, month: number): boolean[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => isNonWorkingDay(year, month, i + 1));
}

/** Array of booleans for each day of a month: true if Saturday or Sunday. */
export function getMonthWeekends(year: number, month: number): boolean[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => isWeekend(year, month, i + 1));
}

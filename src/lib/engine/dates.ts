import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isEqual,
  parseISO,
  startOfDay,
  startOfWeek,
} from "date-fns";

export function toDateString(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function parseDate(s: string): Date {
  return startOfDay(parseISO(s));
}

export function isOnOrBefore(dateStr: string, ref: Date): boolean {
  const d = parseDate(dateStr);
  return isBefore(d, ref) || isEqual(d, ref);
}

export function isOnOrAfter(dateStr: string, ref: Date): boolean {
  const d = parseDate(dateStr);
  return isAfter(d, ref) || isEqual(d, ref);
}

export function getWeekEnd(from: Date): Date {
  return endOfWeek(from, { weekStartsOn: 0 });
}

export function getMonthEnd(from: Date): Date {
  return endOfMonth(from);
}

export function eachDayUntil(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  let current = startOfDay(start);
  const endDay = startOfDay(end);
  while (current <= endDay) {
    days.push(current);
    current = addDays(current, 1);
  }
  return days;
}

export function getYearEnd(from: Date): Date {
  return new Date(from.getFullYear(), 11, 31);
}

export function addMonthsToDate(d: Date, months: number): Date {
  return addMonths(d, months);
}

// All date operations work on ISO "YYYY-MM-DD" strings to avoid timezone issues.
// We anchor to T12:00:00 when constructing Date objects.

export function parseISO(iso: string): Date {
  return new Date(iso + 'T12:00:00');
}

export function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function diffDays(isoA: string, isoB: string): number {
  const a = parseISO(isoA).getTime();
  const b = parseISO(isoB).getTime();
  return Math.round((b - a) / 86400000);
}

// 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
export function dayOfWeek(iso: string): number {
  return parseISO(iso).getDay();
}

export function isoYear(iso: string): number {
  return parseInt(iso.slice(0, 4));
}

export function isoMonth(iso: string): number {
  return parseInt(iso.slice(5, 7));
}

// Friday=5, Saturday=6, Sunday=0
export function isWeekend(iso: string): boolean {
  const dow = dayOfWeek(iso);
  return dow === 5 || dow === 6 || dow === 0;
}

export function isMonday(iso: string): boolean {
  return dayOfWeek(iso) === 1;
}

export function isFriday(iso: string): boolean {
  return dayOfWeek(iso) === 5;
}

// Returns the ISO Monday of the week containing the given date
export function weekMonday(iso: string): string {
  const dow = dayOfWeek(iso);
  const offsetToMon = dow === 0 ? -6 : 1 - dow;
  return addDays(iso, offsetToMon);
}

// Returns all dates from start to end inclusive
export function dateRange(startISO: string, endISO: string): string[] {
  const dates: string[] = [];
  let cur = startISO;
  while (cur <= endISO) {
    dates.push(cur);
    cur = addDays(cur, 1);
  }
  return dates;
}

// Returns all Mon–Fri dates within an EGS span (date = Monday, endDate = Friday)
export function egsSpanDates(startISO: string, endISO: string): string[] {
  return dateRange(startISO, endISO).filter(d => {
    const dow = dayOfWeek(d);
    return dow >= 1 && dow <= 5;
  });
}

// First day of month
export function firstOfMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

// Last day of month
export function lastOfMonth(year: number, month: number): string {
  const next = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-01`;
  return addDays(next, -1);
}

export function monthLabel(iso: string): string {
  const d = parseISO(iso);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function shortDayLabel(iso: string): string {
  return parseISO(iso).toLocaleDateString('en-US', { weekday: 'short' });
}

export function dayNumber(iso: string): number {
  return parseInt(iso.slice(8, 10));
}

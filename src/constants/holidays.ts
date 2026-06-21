// Returns observed holiday dates for a given year.
// If a holiday falls on Saturday → observed Friday before.
// If a holiday falls on Sunday → observed Monday after.
// (The skills.md rule says "observed on the Friday before" for weekends,
//  so we follow that specifically.)

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function dayOfWeek(iso: string): number {
  // 0=Sun, 1=Mon, ..., 6=Sat
  return new Date(iso + 'T12:00:00').getDay();
}

function observedDate(iso: string): string {
  const dow = dayOfWeek(iso);
  if (dow === 6) {
    // Saturday → Friday before
    const d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }
  if (dow === 0) {
    // Sunday → Friday before (per skills.md)
    const d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() - 2);
    return d.toISOString().slice(0, 10);
  }
  return iso;
}

// nth weekday of a month (e.g. 3rd Monday of January)
function nthWeekday(year: number, month: number, weekday: number, n: number): string {
  let count = 0;
  for (let d = 1; d <= 31; d++) {
    const iso = toISO(year, month, d);
    const date = new Date(iso + 'T12:00:00');
    if (date.getMonth() + 1 !== month) break;
    if (date.getDay() === weekday) {
      count++;
      if (count === n) return iso;
    }
  }
  throw new Error(`nthWeekday not found: year=${year} month=${month} weekday=${weekday} n=${n}`);
}

// Last weekday of a month (e.g. last Monday of May for Memorial Day)
function lastWeekday(year: number, month: number, weekday: number): string {
  let result = '';
  for (let d = 1; d <= 31; d++) {
    const iso = toISO(year, month, d);
    const date = new Date(iso + 'T12:00:00');
    if (date.getMonth() + 1 !== month) break;
    if (date.getDay() === weekday) result = iso;
  }
  return result;
}

export function getHolidaysForYear(year: number): Set<string> {
  const holidays = new Set<string>();

  const add = (iso: string) => holidays.add(observedDate(iso));

  add(toISO(year, 1, 1));                          // New Year's Day
  add(nthWeekday(year, 1, 1, 3));                  // MLK Day (3rd Monday Jan)
  add(nthWeekday(year, 2, 1, 3));                  // Presidents' Day (3rd Monday Feb)
  add(lastWeekday(year, 5, 1));                    // Memorial Day (last Monday May)
  add(toISO(year, 7, 4));                          // July 4th
  add(nthWeekday(year, 9, 1, 1));                  // Labor Day (1st Monday Sep)
  add(nthWeekday(year, 11, 4, 4));                 // Thanksgiving (4th Thursday Nov)
  add(toISO(year, 12, 25));                        // Christmas

  return holidays;
}

export function getHolidaysForRange(startISO: string, endISO: string): Set<string> {
  const startYear = parseInt(startISO.slice(0, 4));
  const endYear = parseInt(endISO.slice(0, 4));
  const all = new Set<string>();
  for (let y = startYear; y <= endYear; y++) {
    getHolidaysForYear(y).forEach(d => {
      if (d >= startISO && d <= endISO) all.add(d);
    });
  }
  return all;
}

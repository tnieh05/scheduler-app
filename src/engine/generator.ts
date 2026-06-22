import { v4 as uuidv4 } from 'uuid';
import type { Surgeon } from '../types/surgeon';
import type { Shift, AncillaryKind } from '../types/shift';
import type { Schedule, DateRange } from '../types/schedule';
import {
  dateRange, addDays, isoMonth, isoYear,
  isWeekend, weekMonday,
} from '../lib/dateUtils';
import { SHIFT_QUOTAS } from '../constants/shiftQuotas';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeShift(
  surgeonId: string,
  date: string,
  kind: Shift['kind'],
  endDate?: string,
  ancillaries?: AncillaryKind[],
): Shift {
  return { id: uuidv4(), surgeonId, date, kind, endDate, ancillaries };
}

function monthsInRange(start: string, end: string): { year: number; month: number }[] {
  const months: { year: number; month: number }[] = [];
  let cur = start.slice(0, 7);
  const endMonth = end.slice(0, 7);
  while (cur <= endMonth) {
    const [y, m] = cur.split('-').map(Number);
    months.push({ year: y, month: m });
    cur = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  }
  return months;
}

type QuotaMap = Map<string, { egs: number; h24: number; ocd: number; ocn: number }>;

function quotaKey(surgeonId: string, year: number, month: number) {
  return `${surgeonId}::${year}-${month}`;
}

function initQuotas(surgeons: Surgeon[], start: string, end: string): QuotaMap {
  const map: QuotaMap = new Map();
  for (const { year, month } of monthsInRange(start, end)) {
    for (const s of surgeons) {
      map.set(quotaKey(s.id, year, month), { egs: 0, h24: 0, ocd: 0, ocn: 0 });
    }
  }
  return map;
}

function getQuota(map: QuotaMap, surgeonId: string, year: number, month: number) {
  return map.get(quotaKey(surgeonId, year, month))!;
}

function hasBlackout(surgeon: Surgeon, date: string, kind: 'OCD' | 'OCN'): boolean {
  return surgeon.blackouts.some(b => {
    if (b.date !== date) return false;
    if (kind === 'OCD') return b.type === 'OCD' || b.type === 'BOTH';
    return b.type === 'OCN' || b.type === 'BOTH';
  });
}

// Returns true if `date` falls within the 3-day rest window after any existing call shift.
// Rest window start: day after OCN/24H (shift ends next morning); same day for OCD.
function inRestWindowAfter(shifts: Shift[], surgeonId: string, date: string): boolean {
  return shifts.some(s => {
    if (s.surgeonId !== surgeonId) return false;
    if (s.kind === 'EGS') return false;
    const restStart = s.kind === 'OCN' || s.kind === '24H' ? addDays(s.date, 1) : s.date;
    const gap = daysBetween(restStart, date);
    return gap >= 0 && gap < 3;
  });
}

// Forward check for OCN/24H: would placing an OCN/24H on `date` (ends date+1)
// put any already-placed shift (call or EGS) inside the resulting 3-day rest window?
// EGS is checked by its start date — surgeon cannot begin an EGS week while still resting.
function wouldViolateRestWindow(shifts: Shift[], surgeonId: string, date: string): boolean {
  const ocnEnd = addDays(date, 1);
  return shifts.some(s => {
    if (s.surgeonId !== surgeonId) return false;
    const gap = daysBetween(ocnEnd, s.date);
    return gap >= 0 && gap < 3;
  });
}

// Forward check for OCD: would placing OCD on `date` (rest window starts same day)
// conflict with any already-placed shift on date, date+1, or date+2?
// Needed for Phase 4 because OCN shifts from Phase 3 may fall ahead chronologically.
function wouldViolateOCDRestWindow(shifts: Shift[], surgeonId: string, date: string): boolean {
  return shifts.some(s => {
    if (s.surgeonId !== surgeonId) return false;
    const gap = daysBetween(date, s.date);
    return gap >= 0 && gap < 3;
  });
}

// Count on-call units (OCD, OCN, 24H) for a surgeon in the Mon–Sun week containing `date`.
// 24H counts as 1 unit. Max allowed per week is 2.
function weekCallCount(shifts: Shift[], surgeonId: string, date: string): number {
  const mon = weekMonday(date);
  const sun = addDays(mon, 6);
  return shifts.filter(
    s =>
      s.surgeonId === surgeonId &&
      (s.kind === 'OCD' || s.kind === 'OCN' || s.kind === '24H') &&
      s.date >= mon &&
      s.date <= sun,
  ).length;
}

// Returns true if the surgeon already has a 24H shift in the same Mon–Sun week.
// Prevents back-to-back 24H within a single week; a second call that week must be OCD/OCN.
function has24HInSameWeek(shifts: Shift[], surgeonId: string, date: string): boolean {
  const mon = weekMonday(date);
  const sun = addDays(mon, 6);
  return shifts.some(
    s => s.surgeonId === surgeonId && s.kind === '24H' && s.date >= mon && s.date <= sun,
  );
}

function daysBetween(fromISO: string, toISO: string): number {
  return Math.round(
    (new Date(toISO + 'T12:00:00').getTime() - new Date(fromISO + 'T12:00:00').getTime()) /
      86400000,
  );
}

function blockedByEGS(shifts: Shift[], surgeonId: string, date: string): boolean {
  return shifts.some(s => {
    if (s.surgeonId !== surgeonId || s.kind !== 'EGS') return false;
    if (!s.endDate) return s.date === date; // single-day EGS (coverage sub)
    return date >= s.date && date <= s.endDate; // week-span EGS
  });
}

// Counts days in monthDates where the surgeon can potentially be assigned.
// A day is unavailable if they cannot do EITHER OCD or OCN:
//   - BOTH blackout
//   - EGS assignment covering that date
//   - Robot block ON that date (blocks OCD/OCN/24H on the same day)
//   - Robot block on the NEXT day (blocks OCN/24H the night before)
// OCD-only or OCN-only blackouts still leave the surgeon available for the other type.
// Returns at least 1 to avoid division-by-zero if used as a denominator.
export function computeAvailableDays(
  surgeon: Surgeon,
  monthDates: string[],
  shifts: Shift[],
): number {
  // Build set of dates blocked by robot cases: the robot day itself and the day before.
  const robotBlocked = new Set<string>();
  for (const rb of surgeon.robotBlocks) {
    robotBlocked.add(rb.date);
    robotBlocked.add(addDays(rb.date, -1));
  }

  let count = 0;
  for (const date of monthDates) {
    if (surgeon.blackouts.some(b => b.date === date && b.type === 'BOTH')) continue;
    if (blockedByEGS(shifts, surgeon.id, date)) continue;
    if (robotBlocked.has(date)) continue;
    count++;
  }
  return Math.max(count, 1);
}

function hasShiftOnDate(shifts: Shift[], surgeonId: string, date: string): boolean {
  return shifts.some(s => s.surgeonId === surgeonId && s.date === date);
}

// Returns true when the surgeon has already reached their per-preference monthly cap
// for the given shift kind. null means no cap.
// 24H shifts are counted independently — they do not contribute to maxOcd or maxOcn.
function atMaxLimit(
  surgeon: Surgeon,
  kind: 'OCD' | 'OCN' | '24H',
  shifts: Shift[],
  year: number,
  month: number,
): boolean {
  const max =
    kind === 'OCD' ? surgeon.preferences.maxOcd :
    kind === 'OCN' ? surgeon.preferences.maxOcn :
    surgeon.preferences.max24h;
  if (max == null) return false;
  const count = shifts.filter(
    s =>
      s.surgeonId === surgeon.id &&
      isoYear(s.date) === year &&
      isoMonth(s.date) === month &&
      s.kind === kind,
  ).length;
  return count >= max;
}

function robotBlocksOCD(surgeon: Surgeon, date: string): boolean {
  const tomorrow = addDays(date, 1);
  return surgeon.robotBlocks.some(r => r.date === tomorrow && !r.assistingOnly);
}

function robotBlocksOCN(surgeon: Surgeon, date: string): boolean {
  const tomorrow = addDays(date, 1);
  return surgeon.robotBlocks.some(r => r.date === tomorrow);
}

// Block call ON the robot block date itself (not just the day before).
// OCD is allowed on a same-day assisting block (lighter duty); 24H and OCN are always blocked.
function robotBlocksOnDate(surgeon: Surgeon, date: string, kind: 'OCD' | 'OCN' | '24H'): boolean {
  return surgeon.robotBlocks.some(r => {
    if (r.date !== date) return false;
    if (kind === 'OCD') return !r.assistingOnly;
    return true;
  });
}

// Count on-call weekend shifts (OCD/OCN/24H on Fri/Sat/Sun) for a surgeon in a calendar month.
function weekendShiftCount(shifts: Shift[], surgeonId: string, year: number, month: number): number {
  return shifts.filter(s => {
    if (s.surgeonId !== surgeonId) return false;
    if (s.kind !== 'OCD' && s.kind !== 'OCN' && s.kind !== '24H') return false;
    if (!isWeekend(s.date)) return false;
    return isoYear(s.date) === year && isoMonth(s.date) === month;
  }).length;
}

// True if the surgeon has any on-call shift on a weekend in the week immediately before
// or after the week containing `date`.
function hasAdjacentWeekendShift(shifts: Shift[], surgeonId: string, date: string): boolean {
  const thisMon = weekMonday(date);
  const prevMon = addDays(thisMon, -7);
  const nextMon = addDays(thisMon, 7);
  return shifts.some(s => {
    if (s.surgeonId !== surgeonId) return false;
    if (s.kind !== 'OCD' && s.kind !== 'OCN' && s.kind !== '24H') return false;
    if (!isWeekend(s.date)) return false;
    const mon = weekMonday(s.date);
    return mon === prevMon || mon === nextMon;
  });
}

function weekendEligible(
  shifts: Shift[],
  surgeonId: string,
  date: string,
  year: number,
  month: number,
): boolean {
  if (!isWeekend(date)) return true;
  // Hard cap: never exceed 2 on-call weekend shifts in the same calendar month
  if (weekendShiftCount(shifts, surgeonId, year, month) >= 2) return false;
  // No consecutive weekends (checks the immediately adjacent week in either direction)
  if (hasAdjacentWeekendShift(shifts, surgeonId, date)) return false;
  return true;
}

function monthCallCount(shifts: Shift[], surgeonId: string, year: number, month: number): number {
  return shifts.filter(
    s =>
      s.surgeonId === surgeonId &&
      isoYear(s.date) === year &&
      isoMonth(s.date) === month &&
      (s.kind === 'OCD' || s.kind === 'OCN' || s.kind === '24H'),
  ).length;
}

// Returns true if the surgeon can be assigned `kind` on `date` given `shifts`,
// which must NOT already contain a shift for this surgeon on this date.
function canAssign(
  surgeon: Surgeon,
  date: string,
  kind: 'OCD' | 'OCN' | '24H',
  shifts: Shift[],
  year: number,
  month: number,
): boolean {
  if (hasShiftOnDate(shifts, surgeon.id, date)) return false;
  if (blockedByEGS(shifts, surgeon.id, date)) return false;
  if (inRestWindowAfter(shifts, surgeon.id, date)) return false;
  if (weekCallCount(shifts, surgeon.id, date) >= 2) return false;
  if (!weekendEligible(shifts, surgeon.id, date, year, month)) return false;
  const pref = surgeon.preferences.shiftPreference;
  if (kind === 'OCD') {
    if (pref === '24H_ONLY') return false;
    if (atMaxLimit(surgeon, 'OCD', shifts, year, month)) return false;
    if (hasBlackout(surgeon, date, 'OCD')) return false;
    if (robotBlocksOCD(surgeon, date)) return false;
    if (robotBlocksOnDate(surgeon, date, 'OCD')) return false;
    if (wouldViolateOCDRestWindow(shifts, surgeon.id, date)) return false;
  } else if (kind === 'OCN') {
    if (pref === '24H_ONLY') return false;
    if (atMaxLimit(surgeon, 'OCN', shifts, year, month)) return false;
    if (hasBlackout(surgeon, date, 'OCN')) return false;
    if (robotBlocksOCN(surgeon, date)) return false;
    if (robotBlocksOnDate(surgeon, date, 'OCN')) return false;
    if (wouldViolateRestWindow(shifts, surgeon.id, date)) return false;
  } else {
    if (pref === '12H_ONLY') return false;
    if (atMaxLimit(surgeon, '24H', shifts, year, month)) return false;
    if (hasBlackout(surgeon, date, 'OCD') || hasBlackout(surgeon, date, 'OCN')) return false;
    if (robotBlocksOCN(surgeon, date)) return false;
    if (robotBlocksOnDate(surgeon, date, '24H')) return false;
    if (wouldViolateRestWindow(shifts, surgeon.id, date)) return false;
    if (has24HInSameWeek(shifts, surgeon.id, date)) return false;
  }
  return true;
}

// Actual distinct call events: 24H counts once even though it occupies both OCD and OCN quota slots.
function totalCallCount(q: { h24: number; ocd: number; ocn: number }): number {
  return q.ocd + q.ocn - q.h24;
}

// Soft monthly call target used for urgency-based sorting.
// Surgeons below this target are prioritised in proportion to how few available
// days they have, so constrained surgeons accumulate calls early in the month
// rather than running out of eligible dates before reaching their fair share.
const TARGET_CALLS_PER_MONTH = 4;


// Maps a surgeon's preferences to a priority score for a given shift context.
// Lower score = higher priority. Preferences are tiebreakers after quota-count fairness.
function preferenceScore(surgeon: Surgeon, context: '24H' | 'OCD' | 'OCN'): number {
  const pref = surgeon.preferences.shiftPreference;
  switch (context) {
    case '24H':
      return pref === '24H' || pref === '24H_ONLY' ? -1 : pref === '12H' || pref === '12H_ONLY' ? 1 : 0;
    case 'OCD':
    case 'OCN':
      return pref === '12H' || pref === '12H_ONLY' ? -1 : pref === '24H' || pref === '24H_ONLY' ? 1 : 0;
  }
}

// Days since the surgeon's most recent call shift (any kind except EGS).
// Returns a large number if no prior calls. Used as a soft spacing tiebreaker:
// higher gap = more rested = preferred candidate.
function daysSinceLastCall(shifts: Shift[], surgeonId: string, date: string): number {
  let minGap = Infinity;
  for (const s of shifts) {
    if (s.surgeonId !== surgeonId || s.kind === 'EGS') continue;
    const gap = daysBetween(s.date, date);
    if (gap > 0 && gap < minGap) minGap = gap;
  }
  return minGap === Infinity ? 999 : minGap;
}

// Sort order (earlier = preferred):
//   1. Urgency = (TARGET_CALLS_PER_MONTH − totalCalls) / remainingEligibleDays
//      "Remaining" is computed from the current processing date forward, so urgency
//      rises in real-time as a surgeon's eligible window shrinks. Front-loaded
//      constraints (blocks concentrated early) are caught early instead of too late.
//   2. Spacing: longer rest since last call = preferred (soft)
//   3. Preference score (surgeon-stated preferences)
//   4. Name (deterministic)
function sortedCandidates(
  surgeons: Surgeon[],
  quotas: QuotaMap,
  shifts: Shift[],
  year: number,
  month: number,
  date: string,
  context: '24H' | 'OCD' | 'OCN',
  eligibleDatesMap: Map<string, string[]>,
): Surgeon[] {
  return surgeons.slice().sort((a, b) => {
    const qa = getQuota(quotas, a.id, year, month);
    const qb = getQuota(quotas, b.id, year, month);
    const remA = Math.max(1, (eligibleDatesMap.get(a.id) ?? []).filter(d => d >= date).length);
    const remB = Math.max(1, (eligibleDatesMap.get(b.id) ?? []).filter(d => d >= date).length);

    // Primary: urgency — calls still needed divided by remaining eligible days
    const urgencyA = (TARGET_CALLS_PER_MONTH - totalCallCount(qa)) / remA;
    const urgencyB = (TARGET_CALLS_PER_MONTH - totalCallCount(qb)) / remB;
    const urgencyDiff = urgencyB - urgencyA; // higher urgency first
    if (urgencyDiff !== 0) return urgencyDiff;

    // Soft spacing: prefer the surgeon who rested longer since their last call
    const gapA = daysSinceLastCall(shifts, a.id, date);
    const gapB = daysSinceLastCall(shifts, b.id, date);
    if (gapA !== gapB) return gapB - gapA;

    const prefDiff = preferenceScore(a, context) - preferenceScore(b, context);
    if (prefDiff !== 0) return prefDiff;

    return a.name.localeCompare(b.name);
  });
}

// ─── local search ────────────────────────────────────────────────────────────
//
// After the greedy phases fill the schedule, redistribute shifts from over-loaded
// surgeons to under-loaded ones to close the call-count spread.
//
// Direct move: take one shift from the highest-count surgeon and give it to the
// lowest-count surgeon (when gap ≥ 2 and the receiving surgeon is eligible).
//
// Chain move (fallback): when direct High→Low fails because Low is blocked on
// all of High's dates, try High→Mid + Mid→Low simultaneously. High gives a shift
// to an intermediate surgeon (Mid), and Mid gives one of their shifts to Low.
// Net result: High loses 1, Low gains 1, Mid is unchanged — spread narrows.
function localSearchRefine(
  shifts: Shift[],
  activeSurgeons: Surgeon[],
  year: number,
  month: number,
): void {
  const count = (sId: string) => monthCallCount(shifts, sId, year, month);
  const spread = () => {
    const counts = activeSurgeons.map(s => count(s.id));
    return Math.max(...counts) - Math.min(...counts);
  };
  const monthShifts = (sId: string) =>
    shifts.filter(
      s =>
        s.surgeonId === sId &&
        isoYear(s.date) === year &&
        isoMonth(s.date) === month &&
        (s.kind === 'OCD' || s.kind === 'OCN' || s.kind === '24H'),
    );

  const MAX_PASSES = 200;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    if (spread() <= 1) break;

    const byLoad = activeSurgeons.slice().sort((a, b) => count(a.id) - count(b.id));
    let improved = false;

    // ── Direct move ───────────────────────────────────────────────────────
    outer: for (let hi = byLoad.length - 1; hi > 0; hi--) {
      for (let lo = 0; lo < hi; lo++) {
        const high = byLoad[hi];
        const low = byLoad[lo];
        if (count(high.id) - count(low.id) < 2) continue;
        for (const shift of monthShifts(high.id)) {
          const kind = shift.kind as 'OCD' | 'OCN' | '24H';
          const temp = shifts.filter(s => s !== shift);
          if (canAssign(low, shift.date, kind, temp, year, month)) {
            shift.surgeonId = low.id;
            improved = true;
            break outer;
          }
        }
      }
    }

    // ── Chain move: High→Mid + Mid→Low ───────────────────────────────────
    if (!improved) {
      const high = byLoad[byLoad.length - 1];
      const low = byLoad[0];
      if (count(high.id) - count(low.id) >= 2) {
        const mids = byLoad.slice(1, -1);
        chain: for (const shiftH of monthShifts(high.id)) {
          const kindH = shiftH.kind as 'OCD' | 'OCN' | '24H';
          for (const mid of mids) {
            for (const shiftM of monthShifts(mid.id)) {
              const kindM = shiftM.kind as 'OCD' | 'OCN' | '24H';
              const temp = shifts.filter(s => s !== shiftH && s !== shiftM);
              if (
                canAssign(mid, shiftH.date, kindH, temp, year, month) &&
                canAssign(low, shiftM.date, kindM, temp, year, month)
              ) {
                shiftH.surgeonId = mid.id;
                shiftM.surgeonId = low.id;
                improved = true;
                break chain;
              }
            }
          }
        }
      }
    }

    if (!improved) break;
  }
}

// ─── main generator ─────────────────────────────────────────────────────────
//
// Phase order: 24H → OCN → OCD → Coverage pass
//
// EGS shifts are imported from the block schedule file, not auto-generated.
// Running OCN before OCD ensures all night-shift rest windows are in place when
// OCD is assigned. The coverage pass fills any remaining gaps (may exceed quota).

export function generateSchedule(
  surgeons: Surgeon[],
  range: DateRange,
  existingSchedule?: Schedule,
): Schedule {
  const poolSurgeons = surgeons.filter(s => s.type === 'POOL');
  const activeSurgeons = surgeons.filter(s => s.type !== 'POOL');

  // Seed with every existing shift that falls in the target range.
  // This preserves all manual edits (OCD/OCN placements, removed shifts, pool 24H).
  const shifts: Shift[] = (existingSchedule?.shifts ?? []).filter(
    s => s.date >= range.start && s.date <= range.end,
  );

  // Add pool OCN from availableDates that are not already seeded.
  // Pool surgeons cover the OCN slot only; OCD must still come from regular surgeons.
  for (const pool of poolSurgeons) {
    for (const date of pool.availableDates ?? []) {
      if (date < range.start || date > range.end) continue;
      if (shifts.some(s => s.surgeonId === pool.id && s.date === date && s.kind === 'OCN')) continue;
      shifts.push(makeShift(pool.id, date, 'OCN', undefined, ['PRECALL_AM', 'POSTCALL_PM']));
    }
  }
  const poolIdSet = new Set(poolSurgeons.map(p => p.id));

  const quotas = initQuotas(activeSurgeons, range.start, range.end);

  // Pre-fill quotas from seeded shifts so the generator accounts for existing work.
  for (const shift of shifts) {
    const surgeon = surgeons.find(s => s.id === shift.surgeonId);
    if (!surgeon || surgeon.type === 'POOL') continue;
    const q = quotas.get(quotaKey(shift.surgeonId, isoYear(shift.date), isoMonth(shift.date)));
    if (!q) continue;
    if (shift.kind === 'EGS') q.egs++;
    else if (shift.kind === 'OCD') q.ocd++;
    else if (shift.kind === 'OCN') q.ocn++;
    else if (shift.kind === '24H') { q.h24++; q.ocd++; q.ocn++; }
  }
  const dates = dateRange(range.start, range.end);

  // ── Phases 2–4 + Coverage: process one calendar month at a time ──────────
  // Month-by-month ordering prevents a critical cross-month bug: if Phase 2
  // runs across the full 3-month range at once, it places August 24H assignments
  // (Aug 1, Aug 2, …) before July's OCN/OCD coverage runs. Those August 24H
  // then create forward rest-window conflicts that block late-July candidates
  // (e.g., a surgeon eligible for Jul 31 OCN gets blocked because Aug 1 already
  // has their 24H). Processing each month fully before starting the next avoids
  // this interference while preserving all cross-month constraint checks (rest
  // windows, consecutive weekends, weekly call counts) because every phase reads
  // the shared `shifts` array that accumulates results from all prior months.
  for (const { year, month } of monthsInRange(range.start, range.end)) {
    const monthDates = dates.filter(d => isoYear(d) === year && isoMonth(d) === month);

    // Pre-compute each surgeon's statically eligible dates in this month
    // (excludes BOTH blackouts, robot blocks, and current EGS blocks, but
    // ignores dynamic rest windows). The sort functions filter this list to
    // "remaining eligible dates from the current processing date", giving
    // urgency a denominator that rises in real-time as early slots pass —
    // so front-loaded constraints (like Chau's late-month blocks) drive
    // earlier call assignments rather than waiting until the window closes.
    const eligibleDatesMap = new Map(
      activeSurgeons.map(surgeon => {
        const robotBlocked = new Set<string>();
        for (const rb of surgeon.robotBlocks) {
          robotBlocked.add(rb.date);
          robotBlocked.add(addDays(rb.date, -1));
        }
        return [
          surgeon.id,
          monthDates.filter(d =>
            !surgeon.blackouts.some(b => b.date === d && b.type === 'BOTH') &&
            !robotBlocked.has(d) &&
            !blockedByEGS(shifts, surgeon.id, d),
          ),
        ];
      }),
    );

    // ── Phase 2: 24H Shifts ───────────────────────────────────────────────
    // ── Pre-Phase 2: 24H_ONLY surgeons (weekdays-first) ─────────────────
    // Assign 24H_ONLY surgeons before the main Phase 2 loop, using a
    // weekdays-first date ordering. The main loop processes weekends first,
    // which causes 24H_ONLY surgeons to take Fri wk1 + Fri wk2, then
    // has24HInSameWeek blocks all same-week Mon–Thu. By pre-assigning on
    // weekdays (wk1 Mon, wk2 Mon, wk4 Mon…), each 24H lands in a different
    // week, making room for the full max24h count even when weeks 3–4 have
    // EGS or robot-block constraints.
    for (const surgeon of activeSurgeons) {
      if (surgeon.preferences.shiftPreference !== '24H_ONLY') continue;
      if (surgeon.preferences.max24h == null) continue;
      const orderedDates = [
        ...monthDates.filter(d => !isWeekend(d)),
        ...monthDates.filter(d => isWeekend(d)),
      ];
      for (const d of orderedDates) {
        if (atMaxLimit(surgeon, '24H', shifts, year, month)) break;
        if (shifts.some(s => s.date === d && s.kind === '24H')) continue;
        if (hasBlackout(surgeon, d, 'OCD') || hasBlackout(surgeon, d, 'OCN')) continue;
        if (inRestWindowAfter(shifts, surgeon.id, d)) continue;
        if (wouldViolateRestWindow(shifts, surgeon.id, d)) continue;
        if (weekCallCount(shifts, surgeon.id, d) >= 2) continue;
        if (has24HInSameWeek(shifts, surgeon.id, d)) continue;
        if (blockedByEGS(shifts, surgeon.id, d)) continue;
        if (robotBlocksOCN(surgeon, d)) continue;
        if (robotBlocksOnDate(surgeon, d, '24H')) continue;
        if (!weekendEligible(shifts, surgeon.id, d, year, month)) continue;
        const poolIdx = shifts.findIndex(
          s => s.date === d && s.kind === 'OCN' && poolIdSet.has(s.surgeonId),
        );
        if (poolIdx !== -1) shifts.splice(poolIdx, 1);
        shifts.push(makeShift(surgeon.id, d, '24H', undefined, ['POSTCALL_AM', 'POSTCALL_PM']));
        const q = getQuota(quotas, surgeon.id, year, month);
        q.h24++; q.ocd++; q.ocn++;
      }
    }

    // Weekend dates are processed before weekdays so that end-of-month Fridays
    // (which are hardest to cover due to EGS blocks + consecutive-weekend
    // constraints) receive a 24H assignment before any surgeon's monthly quota
    // is exhausted on lower-priority weekday dates.
    const phase2Dates = [
      ...monthDates.filter(d => isWeekend(d)),
      ...monthDates.filter(d => !isWeekend(d)),
    ];
    for (const date of phase2Dates) {
      // Skip dates already covered by 24H.
      if (shifts.some(s => s.date === date && s.kind === '24H')) continue;

      // On dates where the pool surgeon covers OCN, we normally skip Phase 2
      // (pool + OCD from Phase 4 is sufficient). Exception: if a 24H_ONLY surgeon
      // still needs 24H shifts, allow them to take this slot. Their 24H replaces
      // both OCD and OCN, so the pool's OCN becomes redundant and is removed.
      const poolOCNIndex = shifts.findIndex(
        s => s.date === date && s.kind === 'OCN' && poolIdSet.has(s.surgeonId),
      );
      const hasPoolOCN = poolOCNIndex !== -1;

      const candidates = activeSurgeons.slice().sort((a, b) => {
        const qa = getQuota(quotas, a.id, year, month);
        const qb = getQuota(quotas, b.id, year, month);
        // 24H_ONLY surgeons below their max have no other call path (Phases 3/4
        // assign OCD/OCN which they cannot receive). They must be served by
        // Phase 2 exclusively, so give them priority over regular surgeons.
        const aNeedsOnly =
          a.preferences.shiftPreference === '24H_ONLY' &&
          !atMaxLimit(a, '24H', shifts, year, month);
        const bNeedsOnly =
          b.preferences.shiftPreference === '24H_ONLY' &&
          !atMaxLimit(b, '24H', shifts, year, month);
        if (aNeedsOnly !== bNeedsOnly) return aNeedsOnly ? -1 : 1;
        const remA = Math.max(1, (eligibleDatesMap.get(a.id) ?? []).filter(d => d >= date).length);
        const remB = Math.max(1, (eligibleDatesMap.get(b.id) ?? []).filter(d => d >= date).length);
        const urgencyA = (TARGET_CALLS_PER_MONTH - totalCallCount(qa)) / remA;
        const urgencyB = (TARGET_CALLS_PER_MONTH - totalCallCount(qb)) / remB;
        const urgencyDiff = urgencyB - urgencyA;
        if (urgencyDiff !== 0) return urgencyDiff;
        const gapA = daysSinceLastCall(shifts, a.id, date);
        const gapB = daysSinceLastCall(shifts, b.id, date);
        if (gapA !== gapB) return gapB - gapA;
        const prefDiff = preferenceScore(a, '24H') - preferenceScore(b, '24H');
        if (prefDiff !== 0) return prefDiff;
        return a.name.localeCompare(b.name);
      });

      // Soft half-month rule: reserve each surgeon's second 24H for day 15+ so
      // assignments spread across the whole month. Falls back if no eligible
      // first-half surgeon exists (blackouts, robot blocks, EGS duty, etc.).
      const dayNum = parseInt(date.slice(8, 10), 10);
      const isFirstHalf = dayNum < 15;

      const eligible24H = (surgeon: Surgeon, respectHalfRule: boolean): boolean => {
        const q = getQuota(quotas, surgeon.id, year, month);
        const pref = surgeon.preferences.shiftPreference;
        if (pref === '12H_ONLY') return false;
        if (atMaxLimit(surgeon, '24H', shifts, year, month)) return false;
        if (respectHalfRule && q.h24 >= 1 && isFirstHalf) return false;
        const hasExplicitMax = surgeon.preferences.max24h != null;
        if (pref !== '24H_ONLY' && !hasExplicitMax) {
          if (q.ocd >= SHIFT_QUOTAS[surgeon.type].ocd) return false;
          if (q.ocn >= SHIFT_QUOTAS[surgeon.type].ocn) return false;
        }
        if (hasBlackout(surgeon, date, 'OCD') || hasBlackout(surgeon, date, 'OCN')) return false;
        if (inRestWindowAfter(shifts, surgeon.id, date)) return false;
        if (wouldViolateRestWindow(shifts, surgeon.id, date)) return false;
        if (weekCallCount(shifts, surgeon.id, date) >= 2) return false;
        if (has24HInSameWeek(shifts, surgeon.id, date)) return false;
        if (blockedByEGS(shifts, surgeon.id, date)) return false;
        if (robotBlocksOCN(surgeon, date)) return false;
        if (robotBlocksOnDate(surgeon, date, '24H')) return false;
        if (!weekendEligible(shifts, surgeon.id, date, year, month)) return false;
        return true;
      };

      // For pool-covered dates: only 24H_ONLY surgeons below their max24h may
      // override the pool. All others are adequately served by pool OCN + Phase 4 OCD.
      const only24HNeeding = (s: Surgeon) =>
        s.preferences.shiftPreference === '24H_ONLY' &&
        !atMaxLimit(s, '24H', shifts, year, month);

      let picked: Surgeon | undefined;
      if (hasPoolOCN) {
        const pool24HCandidates = candidates.filter(only24HNeeding);
        if (pool24HCandidates.length === 0) continue;
        picked = pool24HCandidates.find(s => eligible24H(s, true));
        if (!picked) picked = pool24HCandidates.find(s => eligible24H(s, false));
      } else {
        picked = candidates.find(s => eligible24H(s, true));
        if (!picked) picked = candidates.find(s => eligible24H(s, false));
      }

      if (picked) {
        if (hasPoolOCN) {
          // Remove the pool's OCN — the 24H shift covers both OCD and OCN slots.
          shifts.splice(poolOCNIndex, 1);
        }
        const q = getQuota(quotas, picked.id, year, month);
        shifts.push(makeShift(picked.id, date, '24H', undefined, ['POSTCALL_AM', 'POSTCALL_PM']));
        q.h24++;
        q.ocd++;
        q.ocn++;
      }
    }

    // ── 24H_ONLY make-up pass ─────────────────────────────────────────────
    // Phase 2's weekends-first order assigns Lee's weekend 24H in weeks 1
    // and 2 first, then has24HInSameWeek blocks all same-week weekdays.
    // This pass retries all uncovered dates (no half-month rule) to fill
    // any remaining gap for 24H_ONLY surgeons below their max24h.
    for (const surgeon of activeSurgeons) {
      if (surgeon.preferences.shiftPreference !== '24H_ONLY') continue;
      if (surgeon.preferences.max24h == null) continue;
      for (const date of monthDates) {
        if (atMaxLimit(surgeon, '24H', shifts, year, month)) break;
        if (shifts.some(s => s.date === date && s.kind === '24H')) continue;
        if (hasBlackout(surgeon, date, 'OCD') || hasBlackout(surgeon, date, 'OCN')) continue;
        if (inRestWindowAfter(shifts, surgeon.id, date)) continue;
        if (wouldViolateRestWindow(shifts, surgeon.id, date)) continue;
        if (weekCallCount(shifts, surgeon.id, date) >= 2) continue;
        if (has24HInSameWeek(shifts, surgeon.id, date)) continue;
        if (blockedByEGS(shifts, surgeon.id, date)) continue;
        if (robotBlocksOCN(surgeon, date)) continue;
        if (robotBlocksOnDate(surgeon, date, '24H')) continue;
        if (!weekendEligible(shifts, surgeon.id, date, year, month)) continue;
        const poolIdx = shifts.findIndex(
          s => s.date === date && s.kind === 'OCN' && poolIdSet.has(s.surgeonId),
        );
        if (poolIdx !== -1) shifts.splice(poolIdx, 1);
        shifts.push(makeShift(surgeon.id, date, '24H', undefined, ['POSTCALL_AM', 'POSTCALL_PM']));
        const q = getQuota(quotas, surgeon.id, year, month);
        q.h24++; q.ocd++; q.ocn++;
      }
    }

    // ── Phase 3: OCN Shifts ───────────────────────────────────────────────
    // Assign nights before days so rest windows are visible to Phase 4.
    for (const date of monthDates) {
      if (shifts.some(s => s.date === date && s.kind === '24H')) continue;
      if (shifts.some(s => s.date === date && s.kind === 'OCN')) continue;

      const candidates = sortedCandidates(activeSurgeons, quotas, shifts, year, month, date, 'OCN', eligibleDatesMap);

      for (const surgeon of candidates) {
        const q = getQuota(quotas, surgeon.id, year, month);
        if (surgeon.preferences.shiftPreference === '24H_ONLY') continue;
        if (q.ocn >= SHIFT_QUOTAS[surgeon.type].ocn) continue;
        if (atMaxLimit(surgeon, 'OCN', shifts, year, month)) continue;

        if (hasBlackout(surgeon, date, 'OCN')) continue;
        if (inRestWindowAfter(shifts, surgeon.id, date)) continue;
        if (wouldViolateRestWindow(shifts, surgeon.id, date)) continue;
        if (weekCallCount(shifts, surgeon.id, date) >= 2) continue;
        if (blockedByEGS(shifts, surgeon.id, date)) continue;
        if (robotBlocksOCN(surgeon, date)) continue;
        if (robotBlocksOnDate(surgeon, date, 'OCN')) continue;
        if (hasShiftOnDate(shifts, surgeon.id, date)) continue;
        if (!weekendEligible(shifts, surgeon.id, date, year, month)) continue;

        shifts.push(makeShift(surgeon.id, date, 'OCN', undefined, ['PRECALL_AM', 'POSTCALL_PM']));
        q.ocn++;
        break;
      }
    }

    // ── Phase 4: OCD Shifts ───────────────────────────────────────────────
    for (const date of monthDates) {
      if (shifts.some(s => s.date === date && s.kind === '24H')) continue;
      if (shifts.some(s => s.date === date && s.kind === 'OCD')) continue;

      const candidates = sortedCandidates(activeSurgeons, quotas, shifts, year, month, date, 'OCD', eligibleDatesMap);

      for (const surgeon of candidates) {
        const q = getQuota(quotas, surgeon.id, year, month);
        if (surgeon.preferences.shiftPreference === '24H_ONLY') continue;
        if (q.ocd >= SHIFT_QUOTAS[surgeon.type].ocd) continue;
        if (atMaxLimit(surgeon, 'OCD', shifts, year, month)) continue;

        if (hasBlackout(surgeon, date, 'OCD')) continue;
        if (inRestWindowAfter(shifts, surgeon.id, date)) continue;
        if (wouldViolateOCDRestWindow(shifts, surgeon.id, date)) continue;
        if (weekCallCount(shifts, surgeon.id, date) >= 2) continue;
        if (blockedByEGS(shifts, surgeon.id, date)) continue;
        if (robotBlocksOCD(surgeon, date)) continue;
        if (robotBlocksOnDate(surgeon, date, 'OCD')) continue;
        if (hasShiftOnDate(shifts, surgeon.id, date)) continue;
        if (!weekendEligible(shifts, surgeon.id, date, year, month)) continue;

        shifts.push(makeShift(surgeon.id, date, 'OCD'));
        q.ocd++;
        break;
      }
    }

    // ── Coverage pass: fill remaining gaps (may exceed quota) ─────────────
    // Every calendar day must have OCD and OCN. If the main phases couldn't
    // cover a day due to quota exhaustion, pick the least-loaded eligible
    // surgeon regardless of quota. Hard rules (REST_PERIOD, WEEKEND_LIMIT,
    // WEEKLY_CALL_LIMIT) are never relaxed; CONSECUTIVE_WEEKEND is only
    // relaxed on weekdays (never on weekends — prefer COVERAGE_GAP over a
    // CONSECUTIVE_WEEKEND violation on Fri/Sat/Sun).
    //
    // Soft cap: prefer surgeons below COVERAGE_SOFT_CAP total calls before
    // assigning to anyone already at or above it. This keeps the distribution
    // tight (target ~4/month) even when some surgeons are constrained by EGS
    // blocks. Falls back to any eligible surgeon if all are at/above the cap.
    const COVERAGE_SOFT_CAP = 4;

    for (const date of monthDates) {
      if (shifts.some(s => s.date === date && s.kind === '24H')) continue;

      // Same urgency-based sort as the main phases: constrained surgeons (fewer
      // available days relative to calls still needed) remain preferred here too.
      const loadSort = (a: Surgeon, b: Surgeon) => {
        const qa = getQuota(quotas, a.id, year, month);
        const qb = getQuota(quotas, b.id, year, month);
        const remA = Math.max(1, (eligibleDatesMap.get(a.id) ?? []).filter(d => d >= date).length);
        const remB = Math.max(1, (eligibleDatesMap.get(b.id) ?? []).filter(d => d >= date).length);
        const urgencyA = (TARGET_CALLS_PER_MONTH - totalCallCount(qa)) / remA;
        const urgencyB = (TARGET_CALLS_PER_MONTH - totalCallCount(qb)) / remB;
        const urgencyDiff = urgencyB - urgencyA;
        if (urgencyDiff !== 0) return urgencyDiff;
        const gapA = daysSinceLastCall(shifts, a.id, date);
        const gapB = daysSinceLastCall(shifts, b.id, date);
        if (gapA !== gapB) return gapB - gapA;
        return a.name.localeCompare(b.name);
      };

      // Pick the best candidate from a sorted eligible list: prefer under-cap
      // surgeons; fall back to the full sorted list only if all are at/above cap.
      const pickCoverage = (sorted: Surgeon[]): Surgeon | undefined => {
        const underCap = sorted.filter(
          s => totalCallCount(getQuota(quotas, s.id, year, month)) < COVERAGE_SOFT_CAP,
        );
        return underCap.length > 0 ? underCap[0] : sorted[0];
      };

      if (!shifts.some(s => s.date === date && s.kind === 'OCD')) {
        const baseOCD = activeSurgeons.filter(s =>
          s.preferences.shiftPreference !== '24H_ONLY' &&
          !atMaxLimit(s, 'OCD', shifts, year, month) &&
          !hasBlackout(s, date, 'OCD') &&
          !inRestWindowAfter(shifts, s.id, date) &&
          !wouldViolateOCDRestWindow(shifts, s.id, date) &&
          !blockedByEGS(shifts, s.id, date) &&
          !robotBlocksOCD(s, date) &&
          !robotBlocksOnDate(s, date, 'OCD') &&
          !hasShiftOnDate(shifts, s.id, date) &&
          (!isWeekend(date) || weekendShiftCount(shifts, s.id, year, month) < 2) &&
          weekCallCount(shifts, s.id, date) < 2,
        );
        let eligible = baseOCD
          .filter(s => !isWeekend(date) || !hasAdjacentWeekendShift(shifts, s.id, date))
          .sort(loadSort);
        if (eligible.length === 0 && !isWeekend(date)) {
          eligible = baseOCD.sort(loadSort);
        }
        const picked = pickCoverage(eligible);
        if (picked) {
          shifts.push(makeShift(picked.id, date, 'OCD'));
          getQuota(quotas, picked.id, year, month).ocd++;
        }
      }

      if (!shifts.some(s => s.date === date && s.kind === 'OCN')) {
        const baseOCN = activeSurgeons.filter(s =>
          s.preferences.shiftPreference !== '24H_ONLY' &&
          !atMaxLimit(s, 'OCN', shifts, year, month) &&
          !hasBlackout(s, date, 'OCN') &&
          !inRestWindowAfter(shifts, s.id, date) &&
          !wouldViolateRestWindow(shifts, s.id, date) &&
          !blockedByEGS(shifts, s.id, date) &&
          !robotBlocksOCN(s, date) &&
          !robotBlocksOnDate(s, date, 'OCN') &&
          !hasShiftOnDate(shifts, s.id, date) &&
          (!isWeekend(date) || weekendShiftCount(shifts, s.id, year, month) < 2) &&
          weekCallCount(shifts, s.id, date) < 2,
        );
        let eligible = baseOCN
          .filter(s => !isWeekend(date) || !hasAdjacentWeekendShift(shifts, s.id, date))
          .sort(loadSort);
        if (eligible.length === 0 && !isWeekend(date)) {
          eligible = baseOCN.sort(loadSort);
        }
        const picked = pickCoverage(eligible);
        if (picked) {
          shifts.push(makeShift(picked.id, date, 'OCN', undefined, ['PRECALL_AM', 'POSTCALL_PM']));
          getQuota(quotas, picked.id, year, month).ocn++;
        }
      }
    }
  }

  // ── Local search: close call-count spread month by month ─────────────────
  for (const { year, month } of monthsInRange(range.start, range.end)) {
    localSearchRefine(shifts, activeSurgeons, year, month);
  }

  return { range, shifts };
}

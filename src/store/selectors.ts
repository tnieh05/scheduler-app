import type { Violation } from '../types/violation';
import type { Shift } from '../types/shift';
import { dateRange } from '../lib/dateUtils';

// Group violations by surgeonId
export function violationsBySurgeon(violations: Violation[]): Map<string, Violation[]> {
  const map = new Map<string, Violation[]>();
  for (const v of violations) {
    const arr = map.get(v.surgeonId) ?? [];
    arr.push(v);
    map.set(v.surgeonId, arr);
  }
  return map;
}

// Map shiftId → violations for that shift (for red-dot on ShiftChip)
export function violationsByShiftId(violations: Violation[]): Map<string, Violation[]> {
  const map = new Map<string, Violation[]>();
  for (const v of violations) {
    for (const sid of v.shiftIds) {
      const arr = map.get(sid) ?? [];
      arr.push(v);
      map.set(sid, arr);
    }
  }
  return map;
}

// Map "surgeonId::date" → Shift[] for O(1) cell lookup.
// EGS shifts span Mon–Fri, so they are registered under every date in the span.
export function shiftsByCellKey(shifts: Shift[]): Map<string, Shift[]> {
  const map = new Map<string, Shift[]>();
  for (const s of shifts) {
    const dates = s.kind === 'EGS' && s.endDate ? dateRange(s.date, s.endDate) : [s.date];
    for (const date of dates) {
      const key = `${s.surgeonId}::${date}`;
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
  }
  return map;
}

export function errorCount(violations: Violation[]): number {
  return violations.filter(v => v.severity === 'error').length;
}

export function warningCount(violations: Violation[]): number {
  return violations.filter(v => v.severity === 'warning').length;
}

import type { Schedule, Shift, Surgeon } from '../types';
import { isoMonth, isoYear } from './dateUtils';

export function getShiftsForSurgeon(schedule: Schedule, surgeonId: string): Shift[] {
  return schedule.shifts.filter(s => s.surgeonId === surgeonId);
}

export function getShiftsForDate(schedule: Schedule, date: string): Shift[] {
  return schedule.shifts.filter(s => s.date === date);
}

// Key: "surgeonId::date::kind"
export function buildShiftLookup(shifts: Shift[]): Map<string, Shift> {
  const map = new Map<string, Shift>();
  for (const shift of shifts) {
    map.set(`${shift.surgeonId}::${shift.date}`, shift);
  }
  return map;
}

// Key: "surgeonId::date" → Shift (for calendar cell rendering)
export function shiftsByCellKey(shifts: Shift[]): Map<string, Shift[]> {
  const map = new Map<string, Shift[]>();
  for (const shift of shifts) {
    const key = `${shift.surgeonId}::${shift.date}`;
    const existing = map.get(key) ?? [];
    existing.push(shift);
    map.set(key, existing);
  }
  return map;
}

export function getSurgeonById(surgeons: Surgeon[], id: string): Surgeon | undefined {
  return surgeons.find(s => s.id === id);
}

// Count OCD/OCN/EGS shifts for a surgeon in a given month
export function countShiftsInMonth(
  shifts: Shift[],
  surgeonId: string,
  year: number,
  month: number,
) {
  const mine = shifts.filter(s => {
    if (s.surgeonId !== surgeonId) return false;
    return isoYear(s.date) === year && isoMonth(s.date) === month;
  });
  return {
    ocd: mine.filter(s => s.kind === 'OCD' || s.kind === '24H').length,
    ocn: mine.filter(s => s.kind === 'OCN' || s.kind === '24H').length,
    egs: mine.filter(s => s.kind === 'EGS').length,
  };
}

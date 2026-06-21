import { v4 as uuidv4 } from 'uuid';
import { isWeekend, isoMonth, isoYear, weekMonday } from '../../lib/dateUtils';
import type { ValidatorFn } from './ruleTypes';

export const weekendLimitsRule: ValidatorFn = (schedule, surgeons) => {
  const violations = [];

  // Group on-call shifts (OCD/OCN/24H) by surgeon
  const onCallShifts = schedule.shifts.filter(
    s => s.kind === 'OCD' || s.kind === 'OCN' || s.kind === '24H',
  );

  const poolIds = new Set(surgeons.filter(s => s.type === 'POOL').map(s => s.id));

  for (const surgeon of surgeons) {
    if (poolIds.has(surgeon.id)) continue;
    const mine = onCallShifts.filter(s => s.surgeonId === surgeon.id);
    const weekendShifts = mine.filter(s => isWeekend(s.date));

    // Rule 1: max 2 weekend shifts per month
    const byMonth = new Map<string, typeof weekendShifts>();
    for (const s of weekendShifts) {
      const key = `${isoYear(s.date)}-${isoMonth(s.date)}`;
      const arr = byMonth.get(key) ?? [];
      arr.push(s);
      byMonth.set(key, arr);
    }
    for (const [monthKey, shifts] of byMonth) {
      if (shifts.length > 2) {
        violations.push({
          id: uuidv4(),
          ruleId: 'WEEKEND_LIMIT' as const,
          shiftIds: shifts.map(s => s.id),
          surgeonId: surgeon.id,
          date: shifts[0].date,
          message: `${surgeon.name}: ${shifts.length} weekend shifts in ${monthKey} (max 2)`,
          severity: 'error' as const,
        });
      }
    }

    // Rule 2: no consecutive weekends
    // Group weekend shifts by their ISO week Monday
    const byWeek = new Map<string, typeof weekendShifts>();
    for (const s of weekendShifts) {
      const mon = weekMonday(s.date);
      const arr = byWeek.get(mon) ?? [];
      arr.push(s);
      byWeek.set(mon, arr);
    }
    const weeks = Array.from(byWeek.keys()).sort();
    for (let i = 0; i < weeks.length - 1; i++) {
      const a = new Date(weeks[i] + 'T12:00:00');
      const b = new Date(weeks[i + 1] + 'T12:00:00');
      const diffWeeks = Math.round((b.getTime() - a.getTime()) / (7 * 86400000));
      if (diffWeeks === 1) {
        const shiftsA = byWeek.get(weeks[i])!;
        const shiftsB = byWeek.get(weeks[i + 1])!;
        violations.push({
          id: uuidv4(),
          ruleId: 'CONSECUTIVE_WEEKEND' as const,
          shiftIds: [...shiftsA.map(s => s.id), ...shiftsB.map(s => s.id)],
          surgeonId: surgeon.id,
          date: shiftsA[0].date,
          message: `${surgeon.name}: on-call on consecutive weekends (weeks of ${weeks[i]} and ${weeks[i + 1]})`,
          severity: 'error' as const,
        });
      }
    }
  }

  return violations;
};

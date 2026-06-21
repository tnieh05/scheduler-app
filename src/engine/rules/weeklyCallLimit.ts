import { v4 as uuidv4 } from 'uuid';
import { addDays, weekMonday } from '../../lib/dateUtils';
import type { ValidatorFn } from './ruleTypes';

// A surgeon may not have more than 2 on-call units in any Mon–Sun week.
// 24H counts as 1 unit (not 2), as does OCD or OCN individually.
export const weeklyCallLimitRule: ValidatorFn = (schedule, surgeons) => {
  const violations = [];
  const seen = new Set<string>(); // prevent one violation per (surgeon, week)

  for (const shift of schedule.shifts) {
    if (shift.kind !== 'OCD' && shift.kind !== 'OCN' && shift.kind !== '24H') continue;

    const surgeon = surgeons.find(s => s.id === shift.surgeonId);
    if (!surgeon) continue;

    const monday = weekMonday(shift.date);
    const key = `${shift.surgeonId}::${monday}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const sunday = addDays(monday, 6);
    const callsThisWeek = schedule.shifts.filter(
      s =>
        s.surgeonId === shift.surgeonId &&
        (s.kind === 'OCD' || s.kind === 'OCN' || s.kind === '24H') &&
        s.date >= monday &&
        s.date <= sunday,
    );

    if (callsThisWeek.length > 2) {
      violations.push({
        id: uuidv4(),
        ruleId: 'WEEKLY_CALL_LIMIT' as const,
        shiftIds: callsThisWeek.map(s => s.id),
        surgeonId: shift.surgeonId,
        date: monday,
        message: `${surgeon.name}: ${callsThisWeek.length} on-call shifts in week of ${monday} (max 2)`,
        severity: 'error' as const,
      });
    }
  }

  return violations;
};

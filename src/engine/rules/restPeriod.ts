import { v4 as uuidv4 } from 'uuid';
import { addDays, diffDays } from '../../lib/dateUtils';
import type { ValidatorFn } from './ruleTypes';

// Rest rules between on-call shifts and other shifts for the same surgeon.
//
// Call → Call (any combination): minimum 3-day rest.
//   Rest window start:
//     OCN / 24H → the day after the shift (ends next morning)
//     OCD       → the shift date itself (ends same evening)
//   Example: OCD Mon → rest Mon/Tue/Wed → next call no earlier than Thu.
//   Example: OCN Mon → ends Tue → rest Tue/Wed/Thu → next call Fri.
//
// Call → EGS:
//   OCD / OCN → EGS: no rest requirement.
//   24H → EGS: 1 day must separate the end of the 24H from the EGS start.
//     Example: 24H Mon → ends Tue → 1 free day (Tue) → EGS no earlier than Wed.
export const restPeriodRule: ValidatorFn = (schedule, surgeons) => {
  const violations = [];

  // Pool surgeons self-manage their schedule; rest-period rules do not apply to them.
  const poolIds = new Set(surgeons.filter(s => s.type === 'POOL').map(s => s.id));

  const callShifts = schedule.shifts.filter(
    s => (s.kind === 'OCD' || s.kind === 'OCN' || s.kind === '24H') && !poolIds.has(s.surgeonId),
  );

  for (const shift of callShifts) {
    const restStart =
      shift.kind === 'OCN' || shift.kind === '24H'
        ? addDays(shift.date, 1)
        : shift.date;

    const surgeon = surgeons.find(s => s.id === shift.surgeonId);

    for (const other of schedule.shifts) {
      if (other.surgeonId !== shift.surgeonId) continue;
      if (other.id === shift.id) continue;

      const isCall = other.kind === 'OCD' || other.kind === 'OCN' || other.kind === '24H';
      const isEGS = other.kind === 'EGS';
      if (!isCall && !isEGS) continue;

      const gap = diffDays(restStart, other.date);

      if (isEGS) {
        // OCD/OCN before EGS: no restriction.
        if (shift.kind !== '24H') continue;
        // 24H before EGS: need gap >= 1 (1 free day between end of 24H and EGS start).
        if (gap < 0 || gap >= 1) continue;
        violations.push({
          id: uuidv4(),
          ruleId: 'REST_PERIOD' as const,
          shiftIds: [shift.id, other.id],
          surgeonId: shift.surgeonId,
          date: other.date,
          message: `${surgeon?.name ?? shift.surgeonId}: EGS starting ${other.date} needs 1 day after 24H on ${shift.date}`,
          severity: 'error' as const,
        });
      } else {
        // Call → Call: 3-day rule.
        if (gap < 0 || gap >= 3) continue;
        violations.push({
          id: uuidv4(),
          ruleId: 'REST_PERIOD' as const,
          shiftIds: [shift.id, other.id],
          surgeonId: shift.surgeonId,
          date: other.date,
          message: `${surgeon?.name ?? shift.surgeonId}: ${other.kind} on ${other.date} violates 3-day rest after ${shift.kind} on ${shift.date}`,
          severity: 'error' as const,
        });
      }
    }
  }

  return violations;
};

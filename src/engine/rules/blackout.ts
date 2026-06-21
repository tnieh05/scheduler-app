import { v4 as uuidv4 } from 'uuid';
import type { ValidatorFn } from './ruleTypes';

export const blackoutRule: ValidatorFn = (schedule, surgeons) => {
  const violations = [];

  for (const shift of schedule.shifts) {
    if (shift.kind === 'EGS') continue;

    const surgeon = surgeons.find(s => s.id === shift.surgeonId);
    if (!surgeon) continue;

    for (const blackout of surgeon.blackouts) {
      if (blackout.date !== shift.date) continue;

      if (
        (shift.kind === 'OCD' || shift.kind === '24H') &&
        (blackout.type === 'OCD' || blackout.type === 'BOTH')
      ) {
        violations.push({
          id: uuidv4(),
          ruleId: 'BLACKOUT_OCD' as const,
          shiftIds: [shift.id],
          surgeonId: shift.surgeonId,
          date: shift.date,
          message: `${surgeon.name}: OCD shift on blackout date ${shift.date}`,
          severity: 'error' as const,
        });
      }

      if (
        (shift.kind === 'OCN' || shift.kind === '24H') &&
        (blackout.type === 'OCN' || blackout.type === 'BOTH')
      ) {
        violations.push({
          id: uuidv4(),
          ruleId: 'BLACKOUT_OCN' as const,
          shiftIds: [shift.id],
          surgeonId: shift.surgeonId,
          date: shift.date,
          message: `${surgeon.name}: OCN shift on blackout date ${shift.date}`,
          severity: 'error' as const,
        });
      }
    }
  }

  return violations;
};

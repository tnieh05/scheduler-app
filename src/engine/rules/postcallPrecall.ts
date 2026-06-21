import { v4 as uuidv4 } from 'uuid';
import type { ValidatorFn } from './ruleTypes';

export const postcallPrecallRule: ValidatorFn = (schedule, surgeons) => {
  const violations = [];

  for (const shift of schedule.shifts) {
    const surgeon = surgeons.find(s => s.id === shift.surgeonId);
    const name = surgeon?.name ?? shift.surgeonId;

    if (shift.kind === 'OCN') {
      // OCN-only (not 24H): needs PRECALL_AM on shift.date, POSTCALL_PM on shift.date+1
      if (!shift.ancillaries?.includes('PRECALL_AM')) {
        violations.push({
          id: uuidv4(),
          ruleId: 'PRECALL_MISSING' as const,
          shiftIds: [shift.id],
          surgeonId: shift.surgeonId,
          date: shift.date,
          message: `${name}: OCN on ${shift.date} missing Precall AM`,
          severity: 'warning' as const,
        });
      }
      if (!shift.ancillaries?.includes('POSTCALL_PM')) {
        violations.push({
          id: uuidv4(),
          ruleId: 'POSTCALL_MISSING' as const,
          shiftIds: [shift.id],
          surgeonId: shift.surgeonId,
          date: shift.date,
          message: `${name}: OCN on ${shift.date} missing Postcall PM`,
          severity: 'warning' as const,
        });
      }
    }

    if (shift.kind === '24H') {
      // 24H: needs POSTCALL_AM and POSTCALL_PM on the OCN end day
      if (!shift.ancillaries?.includes('POSTCALL_AM')) {
        violations.push({
          id: uuidv4(),
          ruleId: 'POSTCALL_MISSING' as const,
          shiftIds: [shift.id],
          surgeonId: shift.surgeonId,
          date: shift.date,
          message: `${name}: 24H on ${shift.date} missing Postcall AM`,
          severity: 'warning' as const,
        });
      }
      if (!shift.ancillaries?.includes('POSTCALL_PM')) {
        violations.push({
          id: uuidv4(),
          ruleId: 'POSTCALL_MISSING' as const,
          shiftIds: [shift.id],
          surgeonId: shift.surgeonId,
          date: shift.date,
          message: `${name}: 24H on ${shift.date} missing Postcall PM`,
          severity: 'warning' as const,
        });
      }
    }
  }

  return violations;
};

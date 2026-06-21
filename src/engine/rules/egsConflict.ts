import { v4 as uuidv4 } from 'uuid';
import { egsSpanDates } from '../../lib/dateUtils';
import type { ValidatorFn } from './ruleTypes';

export const egsConflictRule: ValidatorFn = (schedule, surgeons) => {
  const violations = [];
  const egsShifts = schedule.shifts.filter(s => s.kind === 'EGS');

  for (const egs of egsShifts) {
    const span = egs.endDate
      ? new Set(egsSpanDates(egs.date, egs.endDate))
      : new Set([egs.date]); // single-day EGS coverage
    const surgeon = surgeons.find(s => s.id === egs.surgeonId);

    for (const other of schedule.shifts) {
      if (other.surgeonId !== egs.surgeonId) continue;
      if (other.id === egs.id) continue;
      if (other.kind === 'EGS') continue;
      if (!span.has(other.date)) continue;

      const spanLabel = egs.endDate ? `${egs.date}–${egs.endDate}` : egs.date;
      violations.push({
        id: uuidv4(),
        ruleId: 'EGS_OVERLAP' as const,
        shiftIds: [egs.id, other.id],
        surgeonId: egs.surgeonId,
        date: other.date,
        message: `${surgeon?.name ?? egs.surgeonId}: ${other.kind} shift overlaps EGS (${spanLabel})`,
        severity: 'error' as const,
      });
    }
  }

  return violations;
};

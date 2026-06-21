import { v4 as uuidv4 } from 'uuid';
import { dateRange } from '../../lib/dateUtils';
import type { ValidatorFn } from './ruleTypes';

// Every calendar day in the range must have both OCD-window and OCN-window coverage.
// A 24H shift satisfies both. Otherwise need at least one OCD and one OCN per date.
export const coverageRule: ValidatorFn = (schedule, _surgeons) => {
  const violations = [];
  const dates = dateRange(schedule.range.start, schedule.range.end);

  for (const date of dates) {
    const dayShifts = schedule.shifts.filter(s => s.date === date);

    // Skip days with no data — not yet imported/scheduled.
    if (dayShifts.length === 0) continue;

    const has24H = dayShifts.some(s => s.kind === '24H');
    if (has24H) continue;

    const hasOCD = dayShifts.some(s => s.kind === 'OCD');
    const hasOCN = dayShifts.some(s => s.kind === 'OCN');

    if (!hasOCD) {
      violations.push({
        id: uuidv4(),
        ruleId: 'COVERAGE_GAP' as const,
        shiftIds: [],
        surgeonId: '',
        date,
        message: `No OCD coverage on ${date} — day shift is unassigned`,
        severity: 'error' as const,
      });
    }

    if (!hasOCN) {
      violations.push({
        id: uuidv4(),
        ruleId: 'COVERAGE_GAP' as const,
        shiftIds: [],
        surgeonId: '',
        date,
        message: `No OCN coverage on ${date} — night shift is unassigned`,
        severity: 'error' as const,
      });
    }
  }

  return violations;
};

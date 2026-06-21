import { v4 as uuidv4 } from 'uuid';
import { dateRange, dayOfWeek, addDays } from '../../lib/dateUtils';
import type { Violation } from '../../types/violation';
import type { ValidatorFn } from './ruleTypes';

// Every complete Mon–Fri week in the range must have at least one EGS shift,
// but only for months where EGS data has been imported. Months with no EGS
// shifts at all are assumed not yet imported and are skipped.
export const egsCoverageRule: ValidatorFn = (schedule, _surgeons) => {
  const violations: Violation[] = [];

  // Determine which calendar months have any EGS data.
  const monthsWithEgs = new Set(
    schedule.shifts.filter(s => s.kind === 'EGS').map(s => s.date.slice(0, 7)),
  );
  if (monthsWithEgs.size === 0) return violations;

  const dates = dateRange(schedule.range.start, schedule.range.end);
  const mondays = dates.filter(d => dayOfWeek(d) === 1);

  for (const monday of mondays) {
    const friday = addDays(monday, 4);
    if (friday > schedule.range.end) break;

    // Skip weeks in months that have no EGS data imported yet.
    if (!monthsWithEgs.has(monday.slice(0, 7))) continue;

    const hasEgs = schedule.shifts.some(s => {
      if (s.kind !== 'EGS') return false;
      if (s.endDate) return s.date <= monday && monday <= s.endDate;
      return s.date >= monday && s.date <= friday;
    });

    if (!hasEgs) {
      violations.push({
        id: uuidv4(),
        ruleId: 'EGS_COVERAGE' as const,
        shiftIds: [],
        surgeonId: '',
        date: monday,
        message: `No EGS surgeon assigned for week of ${monday}`,
        severity: 'error' as const,
      });
    }
  }

  return violations;
};

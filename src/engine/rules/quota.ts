import { v4 as uuidv4 } from 'uuid';
import { isoMonth, isoYear } from '../../lib/dateUtils';
import { SHIFT_QUOTAS } from '../../constants/shiftQuotas';
import type { ValidatorFn } from './ruleTypes';

// Flags POOL surgeons who exceed 6 24H shifts/month (user-assigned, so over-quota is possible)
export const quotaRule: ValidatorFn = (schedule, surgeons) => {
  const violations = [];

  for (const surgeon of surgeons) {
    if (surgeon.type !== 'POOL') continue;

    const max24H = SHIFT_QUOTAS.POOL.h24;
    const myShifts = schedule.shifts.filter(s => s.surgeonId === surgeon.id);

    // Group by month
    const byMonth = new Map<string, typeof myShifts>();
    for (const s of myShifts) {
      const key = `${isoYear(s.date)}-${isoMonth(s.date)}`;
      const arr = byMonth.get(key) ?? [];
      arr.push(s);
      byMonth.set(key, arr);
    }

    for (const [monthKey, shifts] of byMonth) {
      const count24H = shifts.filter(s => s.kind === '24H').length;
      if (count24H > max24H) {
        violations.push({
          id: uuidv4(),
          ruleId: 'QUOTA_EXCEEDED' as const,
          shiftIds: shifts.filter(s => s.kind === '24H').map(s => s.id),
          surgeonId: surgeon.id,
          date: shifts[0].date,
          message: `${surgeon.name}: ${count24H} 24H shifts in ${monthKey} (max ${max24H} for Pool surgeon)`,
          severity: 'error' as const,
        });
      }
    }
  }

  return violations;
};

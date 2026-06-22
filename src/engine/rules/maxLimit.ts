import { v4 as uuidv4 } from 'uuid';
import { isoMonth, isoYear } from '../../lib/dateUtils';
import type { ValidatorFn } from './ruleTypes';

// Flags surgeons who exceed their per-preference monthly max call limits.
// 24H shifts count only toward max24h, not toward maxOcd or maxOcn.
export const maxLimitRule: ValidatorFn = (schedule, surgeons) => {
  const violations = [];

  for (const surgeon of surgeons) {
    const { maxOcd, maxOcn, max24h } = surgeon.preferences;
    if (maxOcd == null && maxOcn == null && max24h == null) continue;

    const myShifts = schedule.shifts.filter(s => s.surgeonId === surgeon.id);

    // Group by "YYYY-MM"
    const months = new Set(myShifts.map(s => `${isoYear(s.date)}-${String(isoMonth(s.date)).padStart(2, '0')}`));

    for (const monthKey of months) {
      const [year, mon] = monthKey.split('-').map(Number);
      const inMonth = myShifts.filter(s => isoYear(s.date) === year && isoMonth(s.date) === mon);
      const firstDate = inMonth[0]?.date ?? monthKey + '-01';

      const ocdCount = inMonth.filter(s => s.kind === 'OCD').length;
      const ocnCount = inMonth.filter(s => s.kind === 'OCN').length;
      const h24Count = inMonth.filter(s => s.kind === '24H').length;

      if (maxOcd != null && ocdCount > maxOcd) {
        violations.push({
          id: uuidv4(),
          ruleId: 'MAX_OCD_EXCEEDED' as const,
          shiftIds: inMonth.filter(s => s.kind === 'OCD').map(s => s.id),
          surgeonId: surgeon.id,
          date: firstDate,
          message: `${surgeon.name}: ${ocdCount} OCD shifts in ${monthKey} (max ${maxOcd})`,
          severity: 'error' as const,
        });
      }

      if (maxOcn != null && ocnCount > maxOcn) {
        violations.push({
          id: uuidv4(),
          ruleId: 'MAX_OCN_EXCEEDED' as const,
          shiftIds: inMonth.filter(s => s.kind === 'OCN').map(s => s.id),
          surgeonId: surgeon.id,
          date: firstDate,
          message: `${surgeon.name}: ${ocnCount} OCN shifts in ${monthKey} (max ${maxOcn})`,
          severity: 'error' as const,
        });
      }

      if (max24h != null && h24Count > max24h) {
        violations.push({
          id: uuidv4(),
          ruleId: 'MAX_24H_EXCEEDED' as const,
          shiftIds: inMonth.filter(s => s.kind === '24H').map(s => s.id),
          surgeonId: surgeon.id,
          date: firstDate,
          message: `${surgeon.name}: ${h24Count} 24H shifts in ${monthKey} (max ${max24h})`,
          severity: 'error' as const,
        });
      }
    }
  }

  return violations;
};

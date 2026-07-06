import type { Schedule } from '../../types/schedule';
import type { Surgeon } from '../../types/surgeon';
import type { Violation } from '../../types/violation';
import type { ScheduleRules } from '../../constants/scheduleRules';

// Rules that don't use any tunable numbers can simply omit the third parameter.
export type ValidatorFn = (
  schedule: Schedule,
  surgeons: Surgeon[],
  rules: ScheduleRules,
) => Violation[];

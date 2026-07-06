import { ALL_RULES } from './rules/index';
import type { Schedule } from '../types/schedule';
import type { Surgeon } from '../types/surgeon';
import type { Violation } from '../types/violation';
import { DEFAULT_RULES, type ScheduleRules } from '../constants/scheduleRules';

export function runAllRules(
  schedule: Schedule,
  surgeons: Surgeon[],
  rules: ScheduleRules = DEFAULT_RULES,
): Violation[] {
  return ALL_RULES.flatMap(rule => rule(schedule, surgeons, rules));
}

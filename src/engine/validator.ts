import { ALL_RULES } from './rules/index';
import type { Schedule } from '../types/schedule';
import type { Surgeon } from '../types/surgeon';
import type { Violation } from '../types/violation';

export function runAllRules(schedule: Schedule, surgeons: Surgeon[]): Violation[] {
  return ALL_RULES.flatMap(rule => rule(schedule, surgeons));
}

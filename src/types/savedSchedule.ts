import type { Schedule, DateRange } from './schedule';
import type { Surgeon } from './surgeon';
import type { ScheduleRules } from '../constants/scheduleRules';

export interface SavedSchedule {
  id: string;
  name: string;
  savedAt: string; // ISO timestamp
  schedule: Schedule;
  surgeons: Surgeon[];
  selectedRange: DateRange;
  rules?: ScheduleRules; // rules in effect when saved; absent on older saves
}

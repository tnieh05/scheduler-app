import type { Schedule, DateRange } from './schedule';
import type { Surgeon } from './surgeon';

export interface SavedSchedule {
  id: string;
  name: string;
  savedAt: string; // ISO timestamp
  schedule: Schedule;
  surgeons: Surgeon[];
  selectedRange: DateRange;
}

import type { Shift } from './shift';

export interface DateRange {
  start: string; // ISO
  end: string;   // ISO
}

export interface Schedule {
  range: DateRange;
  shifts: Shift[];
}

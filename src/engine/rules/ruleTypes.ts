import type { Schedule } from '../../types/schedule';
import type { Surgeon } from '../../types/surgeon';
import type { Violation } from '../../types/violation';

export type ValidatorFn = (schedule: Schedule, surgeons: Surgeon[]) => Violation[];

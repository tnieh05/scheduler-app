import type { SurgeonType } from '../types';

export interface MonthlyQuota {
  egs: number;
  h24: number; // tracks 24H count; also counts toward ocd+ocn
  ocd: number;
  ocn: number;
}

// Per skills.md: EGS = 1 EGS + 3 OCD + 2 OCN; NON_EGS = 4 OCD + 3 OCN.
// 24H counts as 1 OCD + 1 OCN toward these totals.
// h24 for active surgeons is unlimited here; per-surgeon max24h preference controls the cap.
export const SHIFT_QUOTAS: Record<SurgeonType, MonthlyQuota> = {
  EGS:     { egs: 1, h24: 31, ocd: 3, ocn: 2 },
  NON_EGS: { egs: 0, h24: 31, ocd: 4, ocn: 3 },
  POOL:    { egs: 0, h24: 6,  ocd: 0, ocn: 0 },
};

import type { SurgeonType } from '../types';

export interface MonthlyQuota {
  egs: number;
  h24: number; // 24H calls (max 2/month; also counts toward ocd+ocn)
  ocd: number;
  ocn: number;
}

// Per skills.md: EGS = 1 EGS + 3 OCD + 2 OCN; NON_EGS = 4 OCD + 3 OCN.
// 24H counts as 1 OCD + 1 OCN toward these totals (h24 ≤ 2).
export const SHIFT_QUOTAS: Record<SurgeonType, MonthlyQuota> = {
  EGS:    { egs: 1, h24: 2, ocd: 3, ocn: 2 },
  NON_EGS: { egs: 0, h24: 2, ocd: 4, ocn: 3 },
  POOL:   { egs: 0, h24: 6, ocd: 0, ocn: 0 },
};

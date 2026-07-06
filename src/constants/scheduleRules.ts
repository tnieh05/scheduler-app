// Central definition of every tunable scheduling rule. Both engines read these:
// the TypeScript generator/validator directly, and the Python solver via the
// `rules` field on the /generate request (defaults there must stay in sync —
// see backend/solver/types.py ScheduleRules).
//
// Rest-window semantics (must match in both engines):
//   The window is counted from when the shift ENDS — the day after an OCN/24H
//   (which run overnight), the same day for an OCD. A window of 3 therefore
//   blocks the 2 days after an OCD and the 3 days after an OCN/24H.

export interface ScheduleRules {
  /** Days of rest counted from shift end. Default 3. */
  restWindowDays: number;
  /** Max on-call units (OCD/OCN/24H each = 1) per Mon–Sun week. Default 2. */
  maxCallsPerWeek: number;
  /** Max weekend (Fri/Sat/Sun) calls per surgeon per month. Default 2. */
  maxWeekendShiftsPerMonth: number;
  /**
   * Default max 24H shifts per surgeon per month when no per-surgeon max24h
   * preference is set. Currently enforced by the Python solver only — the
   * TypeScript generator leaves 24H uncapped unless a per-surgeon max is set.
   */
  monthlyMax24h: number;
}

export const DEFAULT_RULES: ScheduleRules = {
  restWindowDays: 3,
  maxCallsPerWeek: 2,
  maxWeekendShiftsPerMonth: 2,
  monthlyMax24h: 2,
};

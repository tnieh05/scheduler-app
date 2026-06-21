export type RuleId =
  | 'BLACKOUT_OCD'
  | 'BLACKOUT_OCN'
  | 'BLACKOUT_BOTH'
  | 'EGS_OVERLAP'
  | 'REST_PERIOD'
  | 'ROBOT_BLOCK'
  | 'WEEKEND_LIMIT'
  | 'CONSECUTIVE_WEEKEND'
  | 'QUOTA_EXCEEDED'
  | 'PRECALL_MISSING'
  | 'POSTCALL_MISSING'
  | 'COVERAGE_GAP'
  | 'EGS_COVERAGE'
  | 'WEEKLY_CALL_LIMIT';

export interface Violation {
  id: string;
  ruleId: RuleId;
  shiftIds: string[];
  surgeonId: string;
  date: string;
  message: string;
  severity: 'error' | 'warning';
}

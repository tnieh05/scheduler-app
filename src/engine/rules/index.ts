import { blackoutRule } from './blackout';
import { egsConflictRule } from './egsConflict';
import { egsCoverageRule } from './egsCoverage';
import { restPeriodRule } from './restPeriod';
import { robotBlockRule } from './robotBlock';
import { weekendLimitsRule } from './weekendLimits';
import { weeklyCallLimitRule } from './weeklyCallLimit';
import { postcallPrecallRule } from './postcallPrecall';
import { quotaRule } from './quota';
import { coverageRule } from './coverage';
import type { ValidatorFn } from './ruleTypes';

export const ALL_RULES: ValidatorFn[] = [
  coverageRule,
  egsCoverageRule,
  blackoutRule,
  egsConflictRule,
  restPeriodRule,
  robotBlockRule,
  weekendLimitsRule,
  weeklyCallLimitRule,
  postcallPrecallRule,
  quotaRule,
];

import { v4 as uuidv4 } from 'uuid';
import { addDays } from '../../lib/dateUtils';
import type { ValidatorFn } from './ruleTypes';

export const robotBlockRule: ValidatorFn = (schedule, surgeons) => {
  const violations = [];

  for (const surgeon of surgeons) {
    for (const robot of surgeon.robotBlocks) {
      const dayBefore = addDays(robot.date, -1);

      for (const shift of schedule.shifts) {
        if (shift.surgeonId !== surgeon.id) continue;
        if (shift.kind === 'EGS') continue;

        // No call the day before a robot procedure
        if (shift.date === dayBefore) {
          if (robot.assistingOnly && shift.kind === 'OCD') continue;
          violations.push({
            id: uuidv4(),
            ruleId: 'ROBOT_BLOCK' as const,
            shiftIds: [shift.id],
            surgeonId: surgeon.id,
            date: shift.date,
            message: `${surgeon.name}: ${shift.kind} on ${shift.date} is the day before robot block on ${robot.date}${robot.assistingOnly ? '' : ' (not assisting)'}`,
            severity: 'error' as const,
          });
        }

        // No call on the robot block date itself
        if (shift.date === robot.date) {
          if (robot.assistingOnly && shift.kind === 'OCD') continue;
          violations.push({
            id: uuidv4(),
            ruleId: 'ROBOT_BLOCK' as const,
            shiftIds: [shift.id],
            surgeonId: surgeon.id,
            date: shift.date,
            message: `${surgeon.name}: ${shift.kind} on ${shift.date} conflicts with robot block on the same day`,
            severity: 'error' as const,
          });
        }
      }
    }
  }

  return violations;
};

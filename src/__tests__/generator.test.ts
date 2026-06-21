import { describe, it, expect } from 'vitest';
import { generateSchedule } from '../engine/generator';
import { runAllRules } from '../engine/validator';
import { weekMonday, addDays } from '../lib/dateUtils';
import type { Surgeon } from '../types/surgeon';
import type { DateRange } from '../types/schedule';

// Mirrors the real roster from the app (8 EGS + 3 NON_EGS, no POOL)
function makeSurgeon(name: string, type: Surgeon['type']): Surgeon {
  return {
    id: name.toLowerCase().replace(/\s/g, '-'),
    name,
    type,
    blackouts: [],
    robotBlocks: [],
    preferences: { shiftPreference: 'none', customNotes: '' },
  };
}

const SURGEONS: Surgeon[] = [
  makeSurgeon('Dr. A', 'EGS'),
  makeSurgeon('Dr. B', 'EGS'),
  makeSurgeon('Dr. C', 'EGS'),
  makeSurgeon('Dr. D', 'EGS'),
  makeSurgeon('Dr. E', 'EGS'),
  makeSurgeon('Dr. F', 'EGS'),
  makeSurgeon('Dr. G', 'EGS'),
  makeSurgeon('Dr. H', 'EGS'),
  makeSurgeon('Dr. I', 'NON_EGS'),
  makeSurgeon('Dr. J', 'NON_EGS'),
  makeSurgeon('Dr. K', 'NON_EGS'),
];

// The real 3-month range the user schedules (Jul–Sep 2026)
const RANGE: DateRange = { start: '2026-07-01', end: '2026-09-30' };

// Shorter range for faster iteration during debugging
const RANGE_ONE_MONTH: DateRange = { start: '2026-07-01', end: '2026-07-31' };

describe('generateSchedule — 0 violations', () => {
  it('produces no rule violations over a single month (Jul 2026)', () => {
    const schedule = generateSchedule(SURGEONS, RANGE_ONE_MONTH);
    const violations = runAllRules(schedule, SURGEONS);

    // Print details on failure so it's easy to see what broke
    if (violations.length > 0) {
      const summary = violations.map(v => `  [${v.ruleId}] ${v.message}`).join('\n');
      console.error(`\n${violations.length} violation(s):\n${summary}\n`);
    }

    expect(violations).toHaveLength(0);
  });

  it('produces no rule violations over 3 months (Jul–Sep 2026)', () => {
    const schedule = generateSchedule(SURGEONS, RANGE);
    const violations = runAllRules(schedule, SURGEONS);

    if (violations.length > 0) {
      const grouped = new Map<string, number>();
      for (const v of violations) {
        grouped.set(v.ruleId, (grouped.get(v.ruleId) ?? 0) + 1);
      }
      const summary = [...grouped.entries()].map(([k, n]) => `  ${k}: ${n}`).join('\n');
      console.error(`\n${violations.length} violation(s) by type:\n${summary}`);
      const details = violations.slice(0, 10).map(v => `  [${v.ruleId}] ${v.message}`).join('\n');
      console.error(`First 10:\n${details}\n`);
    }

    expect(violations).toHaveLength(0);
  });

  it('produces no violations with blackouts and robot blocks', () => {
    const surgeons: Surgeon[] = SURGEONS.map((s, i) => ({
      ...s,
      // Give every 3rd surgeon a few constraints to stress-test the generator
      blackouts: i % 3 === 0
        ? [
            { date: '2026-07-04', type: 'BOTH' as const },
            { date: '2026-07-11', type: 'OCD' as const },
            { date: '2026-08-03', type: 'OCN' as const },
          ]
        : [],
      robotBlocks: i % 4 === 0
        ? [{ date: '2026-07-15', assistingOnly: false }]
        : [],
    }));

    const schedule = generateSchedule(surgeons, RANGE);
    const violations = runAllRules(schedule, surgeons);

    if (violations.length > 0) {
      const summary = violations.map(v => `  [${v.ruleId}] ${v.message}`).join('\n');
      console.error(`\n${violations.length} violation(s):\n${summary}\n`);
    }

    expect(violations).toHaveLength(0);
  });
});

// Granular per-rule tests so failures are immediately obvious
describe('generateSchedule — per-rule checks (3 months)', () => {
  let violations: ReturnType<typeof runAllRules>;

  // Run once and share across sub-tests
  const schedule = generateSchedule(SURGEONS, RANGE);
  violations = runAllRules(schedule, SURGEONS);

  const byRule = (ruleId: string) => violations.filter(v => v.ruleId === ruleId);

  it('no COVERAGE_GAP', () => {
    expect(byRule('COVERAGE_GAP')).toHaveLength(0);
  });

  it('no REST_PERIOD', () => {
    const v = byRule('REST_PERIOD');
    if (v.length) console.error(v.map(x => x.message).join('\n'));
    expect(v).toHaveLength(0);
  });

  it('no WEEKLY_CALL_LIMIT', () => {
    const v = byRule('WEEKLY_CALL_LIMIT');
    if (v.length) console.error(v.map(x => x.message).join('\n'));
    expect(v).toHaveLength(0);
  });

  it('no WEEKEND_LIMIT', () => {
    const v = byRule('WEEKEND_LIMIT');
    if (v.length) console.error(v.map(x => x.message).join('\n'));
    expect(v).toHaveLength(0);
  });

  it('no CONSECUTIVE_WEEKEND', () => {
    const v = byRule('CONSECUTIVE_WEEKEND');
    if (v.length) console.error(v.map(x => x.message).join('\n'));
    expect(v).toHaveLength(0);
  });

  it('no BLACKOUT_OCD / BLACKOUT_OCN / BLACKOUT_BOTH', () => {
    const v = violations.filter(v => v.ruleId.startsWith('BLACKOUT'));
    expect(v).toHaveLength(0);
  });

  it('no EGS_OVERLAP', () => {
    expect(byRule('EGS_OVERLAP')).toHaveLength(0);
  });

  it('no ROBOT_BLOCK', () => {
    expect(byRule('ROBOT_BLOCK')).toHaveLength(0);
  });

  it('no 24H/OCN/OCD shift within 3 days before an EGS start', () => {
    const egsShifts = schedule.shifts.filter(s => s.kind === 'EGS');
    const callShifts = schedule.shifts.filter(s => s.kind === 'OCD' || s.kind === 'OCN' || s.kind === '24H');
    const bad: string[] = [];
    for (const egs of egsShifts) {
      for (const call of callShifts) {
        if (call.surgeonId !== egs.surgeonId) continue;
        const restStart = call.kind === 'OCD' ? call.date : addDays(call.date, 1);
        const gap = Math.round(
          (new Date(egs.date + 'T12:00:00').getTime() - new Date(restStart + 'T12:00:00').getTime()) / 86400000,
        );
        if (gap >= 0 && gap < 3) {
          const name = SURGEONS.find(x => x.id === call.surgeonId)?.name ?? call.surgeonId;
          bad.push(`${name}: ${call.kind} on ${call.date} → EGS on ${egs.date} (gap ${gap}d)`);
        }
      }
    }
    if (bad.length > 0) console.error('\nCall-before-EGS violations:\n' + bad.join('\n'));
    expect(bad).toHaveLength(0);
  });

  it('no surgeon has two 24H shifts in the same week', () => {
    const shifts24H = schedule.shifts.filter(s => s.kind === '24H');
    const doubleWeeks: string[] = [];
    for (const s of shifts24H) {
      const mon = weekMonday(s.date);
      const sun = addDays(mon, 6);
      const same = shifts24H.filter(
        o => o.id !== s.id && o.surgeonId === s.surgeonId && o.date >= mon && o.date <= sun,
      );
      if (same.length > 0) {
        const name = SURGEONS.find(x => x.id === s.surgeonId)?.name ?? s.surgeonId;
        doubleWeeks.push(`${name}: 24H on ${s.date} and ${same[0].date} (week ${mon})`);
      }
    }
    if (doubleWeeks.length > 0) console.error('\nDouble-24H violations:\n' + doubleWeeks.join('\n'));
    expect(doubleWeeks).toHaveLength(0);
  });
});

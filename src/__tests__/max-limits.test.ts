/**
 * TDD tests for per-surgeon max call limits (maxOcd, maxOcn, max24h).
 *
 * Tests are written against the expected behavior BEFORE implementation so
 * failures confirm the feature is absent, then pass once implemented.
 *
 * Rules under test:
 * - Generator respects per-surgeon max limits as hard constraints
 * - Local search does not push a surgeon above their limits
 * - Coverage pass also respects max limits (no bypass)
 * - Validator flags violations when a surgeon exceeds their limits
 * - 24H shifts do not count toward maxOcd / maxOcn (they are separate)
 * - Limits are per calendar month, not per range
 */
import { describe, it, expect } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { generateSchedule } from '../engine/generator';
import { maxLimitRule } from '../engine/rules/maxLimit';
import { isoMonth, isoYear } from '../lib/dateUtils';
import { defaultPreferences } from '../types';
import type { Surgeon, SurgeonPreferences } from '../types/surgeon';
import type { Schedule, DateRange } from '../types/schedule';
import type { Shift } from '../types/shift';

// ─── helpers ────────────────────────────────────────────────────────────────

const RANGE: DateRange = { start: '2026-07-01', end: '2026-07-31' };
const RANGE_3MO: DateRange = { start: '2026-07-01', end: '2026-09-30' };

function makeSurgeon(
  name: string,
  type: Surgeon['type'] = 'EGS',
  prefs: Partial<SurgeonPreferences> = {},
): Surgeon {
  return {
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    type,
    blackouts: [],
    robotBlocks: [],
    preferences: { ...defaultPreferences, ...prefs },
  };
}

function makeShift(surgeonId: string, date: string, kind: Shift['kind']): Shift {
  return { id: uuidv4(), surgeonId, date, kind };
}

// 10 base surgeons — enough to cover every day even with one surgeon restricted
const BASE_SURGEONS: Surgeon[] = [
  makeSurgeon('Dr. A'), makeSurgeon('Dr. B'), makeSurgeon('Dr. C'),
  makeSurgeon('Dr. D'), makeSurgeon('Dr. E'), makeSurgeon('Dr. F'),
  makeSurgeon('Dr. G'), makeSurgeon('Dr. H'),
  makeSurgeon('Dr. I', 'NON_EGS'), makeSurgeon('Dr. J', 'NON_EGS'),
];

function countKindPerMonth(
  shifts: Shift[],
  surgeonId: string,
  kind: Shift['kind'],
): Map<string, number> {
  const result = new Map<string, number>();
  for (const s of shifts) {
    if (s.surgeonId !== surgeonId || s.kind !== kind) continue;
    const key = `${isoYear(s.date)}-${String(isoMonth(s.date)).padStart(2, '0')}`;
    result.set(key, (result.get(key) ?? 0) + 1);
  }
  return result;
}

// ─── Generator: max limits enforced ─────────────────────────────────────────

describe('generator — max limits', () => {
  it('max24h = 0 → surgeon receives no 24H shifts', () => {
    const restricted = makeSurgeon('Dr. X', 'EGS', { max24h: 0 });
    const schedule = generateSchedule([...BASE_SURGEONS, restricted], RANGE);
    const h24 = schedule.shifts.filter(s => s.surgeonId === restricted.id && s.kind === '24H');
    expect(h24).toHaveLength(0);
  });

  it('maxOcn = 1 → surgeon receives at most 1 OCN per month over 3 months', () => {
    const restricted = makeSurgeon('Dr. X', 'EGS', { maxOcn: 1 });
    const schedule = generateSchedule([...BASE_SURGEONS, restricted], RANGE_3MO);
    for (const [, count] of countKindPerMonth(schedule.shifts, restricted.id, 'OCN')) {
      expect(count).toBeLessThanOrEqual(1);
    }
  });

  it('maxOcd = 2 → surgeon receives at most 2 OCD per month over 3 months', () => {
    const restricted = makeSurgeon('Dr. X', 'EGS', { maxOcd: 2 });
    const schedule = generateSchedule([...BASE_SURGEONS, restricted], RANGE_3MO);
    for (const [, count] of countKindPerMonth(schedule.shifts, restricted.id, 'OCD')) {
      expect(count).toBeLessThanOrEqual(2);
    }
  });

  it('null limits → surgeon receives some calls (no unintended zeroing)', () => {
    const unrestricted = makeSurgeon('Dr. X', 'EGS', { max24h: null, maxOcn: null, maxOcd: null });
    const schedule = generateSchedule([...BASE_SURGEONS, unrestricted], RANGE);
    const calls = schedule.shifts.filter(
      s => s.surgeonId === unrestricted.id && (s.kind === 'OCD' || s.kind === 'OCN' || s.kind === '24H'),
    );
    expect(calls.length).toBeGreaterThan(0);
  });

  it('maxOcd = 0 → surgeon receives no OCD shifts', () => {
    const restricted = makeSurgeon('Dr. X', 'EGS', { maxOcd: 0 });
    const schedule = generateSchedule([...BASE_SURGEONS, restricted], RANGE);
    const ocd = schedule.shifts.filter(s => s.surgeonId === restricted.id && s.kind === 'OCD');
    expect(ocd).toHaveLength(0);
  });

  it('maxOcn = 0 → surgeon receives no standalone OCN shifts', () => {
    const restricted = makeSurgeon('Dr. X', 'EGS', { maxOcn: 0 });
    const schedule = generateSchedule([...BASE_SURGEONS, restricted], RANGE);
    const ocn = schedule.shifts.filter(s => s.surgeonId === restricted.id && s.kind === 'OCN');
    expect(ocn).toHaveLength(0);
  });

  it('all limits = 0 → surgeon receives no call shifts at all', () => {
    const restricted = makeSurgeon('Dr. X', 'EGS', { max24h: 0, maxOcn: 0, maxOcd: 0 });
    const schedule = generateSchedule([...BASE_SURGEONS, restricted], RANGE);
    const calls = schedule.shifts.filter(
      s => s.surgeonId === restricted.id && (s.kind === 'OCD' || s.kind === 'OCN' || s.kind === '24H'),
    );
    expect(calls).toHaveLength(0);
  });

  it('limits are enforced independently across all 3 months', () => {
    const restricted = makeSurgeon('Dr. X', 'EGS', { max24h: 1, maxOcn: 1, maxOcd: 1 });
    const schedule = generateSchedule([...BASE_SURGEONS, restricted], RANGE_3MO);
    for (const [, c] of countKindPerMonth(schedule.shifts, restricted.id, '24H')) {
      expect(c).toBeLessThanOrEqual(1);
    }
    for (const [, c] of countKindPerMonth(schedule.shifts, restricted.id, 'OCN')) {
      expect(c).toBeLessThanOrEqual(1);
    }
    for (const [, c] of countKindPerMonth(schedule.shifts, restricted.id, 'OCD')) {
      expect(c).toBeLessThanOrEqual(1);
    }
  });

  it('local search does not push a surgeon above their max limits', () => {
    // 11 surgeons forces load-balancing; restricted surgeon must still be respected
    const restricted = makeSurgeon('Dr. X', 'EGS', { maxOcd: 1, maxOcn: 1, max24h: 1 });
    const schedule = generateSchedule([...BASE_SURGEONS, restricted], RANGE_3MO);
    for (const [, c] of countKindPerMonth(schedule.shifts, restricted.id, 'OCD')) {
      expect(c).toBeLessThanOrEqual(1);
    }
    for (const [, c] of countKindPerMonth(schedule.shifts, restricted.id, 'OCN')) {
      expect(c).toBeLessThanOrEqual(1);
    }
    for (const [, c] of countKindPerMonth(schedule.shifts, restricted.id, '24H')) {
      expect(c).toBeLessThanOrEqual(1);
    }
  });

  it('24H_ONLY preference with max24h = 0 → no 24H shifts assigned', () => {
    const restricted = makeSurgeon('Dr. X', 'EGS', { shiftPreference: '24H_ONLY', max24h: 0 });
    const schedule = generateSchedule([...BASE_SURGEONS, restricted], RANGE);
    const h24 = schedule.shifts.filter(s => s.surgeonId === restricted.id && s.kind === '24H');
    expect(h24).toHaveLength(0);
  });

  it('12H_ONLY preference with max24h = 0 → no 24H shifts assigned', () => {
    const restricted = makeSurgeon('Dr. X', 'EGS', { shiftPreference: '12H_ONLY', max24h: 0 });
    const schedule = generateSchedule([...BASE_SURGEONS, restricted], RANGE);
    const h24 = schedule.shifts.filter(s => s.surgeonId === restricted.id && s.kind === '24H');
    expect(h24).toHaveLength(0);
  });

  it('coverage pass respects maxOcd = 0 even when coverage is tight', () => {
    // Even in the fallback coverage pass, hard limits must hold
    const restricted = makeSurgeon('Dr. X', 'EGS', { maxOcd: 0 });
    const schedule = generateSchedule([...BASE_SURGEONS, restricted], RANGE);
    const ocd = schedule.shifts.filter(s => s.surgeonId === restricted.id && s.kind === 'OCD');
    expect(ocd).toHaveLength(0);
  });

  it('coverage pass respects maxOcn = 0 even when coverage is tight', () => {
    const restricted = makeSurgeon('Dr. X', 'EGS', { maxOcn: 0 });
    const schedule = generateSchedule([...BASE_SURGEONS, restricted], RANGE);
    const ocn = schedule.shifts.filter(s => s.surgeonId === restricted.id && s.kind === 'OCN');
    expect(ocn).toHaveLength(0);
  });
});

// ─── Validator: maxLimitRule ─────────────────────────────────────────────────

describe('maxLimitRule', () => {
  it('flags MAX_OCD_EXCEEDED when surgeon has more OCD than maxOcd', () => {
    const surgeon = makeSurgeon('Dr. X', 'EGS', { maxOcd: 1 });
    const schedule: Schedule = {
      range: RANGE,
      shifts: [
        makeShift(surgeon.id, '2026-07-02', 'OCD'),
        makeShift(surgeon.id, '2026-07-09', 'OCD'),
      ],
    };
    const violations = maxLimitRule(schedule, [surgeon]);
    expect(violations.some(v => v.ruleId === 'MAX_OCD_EXCEEDED')).toBe(true);
  });

  it('flags MAX_OCN_EXCEEDED when surgeon has more OCN than maxOcn', () => {
    const surgeon = makeSurgeon('Dr. X', 'EGS', { maxOcn: 1 });
    const schedule: Schedule = {
      range: RANGE,
      shifts: [
        makeShift(surgeon.id, '2026-07-02', 'OCN'),
        makeShift(surgeon.id, '2026-07-09', 'OCN'),
      ],
    };
    const violations = maxLimitRule(schedule, [surgeon]);
    expect(violations.some(v => v.ruleId === 'MAX_OCN_EXCEEDED')).toBe(true);
  });

  it('flags MAX_24H_EXCEEDED when surgeon has more 24H than max24h', () => {
    const surgeon = makeSurgeon('Dr. X', 'EGS', { max24h: 1 });
    const schedule: Schedule = {
      range: RANGE,
      shifts: [
        makeShift(surgeon.id, '2026-07-05', '24H'),
        makeShift(surgeon.id, '2026-07-19', '24H'),
      ],
    };
    const violations = maxLimitRule(schedule, [surgeon]);
    expect(violations.some(v => v.ruleId === 'MAX_24H_EXCEEDED')).toBe(true);
  });

  it('no violation when count equals limit exactly', () => {
    const surgeon = makeSurgeon('Dr. X', 'EGS', { maxOcn: 2 });
    const schedule: Schedule = {
      range: RANGE,
      shifts: [
        makeShift(surgeon.id, '2026-07-02', 'OCN'),
        makeShift(surgeon.id, '2026-07-09', 'OCN'),
      ],
    };
    const violations = maxLimitRule(schedule, [surgeon]);
    expect(violations.filter(v => v.ruleId === 'MAX_OCN_EXCEEDED')).toHaveLength(0);
  });

  it('no violation when limits are null (not set)', () => {
    const surgeon = makeSurgeon('Dr. X', 'EGS', { max24h: null, maxOcn: null, maxOcd: null });
    const schedule: Schedule = {
      range: RANGE,
      shifts: [
        makeShift(surgeon.id, '2026-07-03', '24H'),
        makeShift(surgeon.id, '2026-07-10', '24H'),
        makeShift(surgeon.id, '2026-07-17', '24H'),
        makeShift(surgeon.id, '2026-07-24', '24H'),
      ],
    };
    const violations = maxLimitRule(schedule, [surgeon]);
    const maxViolations = violations.filter(v =>
      v.ruleId === 'MAX_OCD_EXCEEDED' || v.ruleId === 'MAX_OCN_EXCEEDED' || v.ruleId === 'MAX_24H_EXCEEDED',
    );
    expect(maxViolations).toHaveLength(0);
  });

  it('no violation when within limits', () => {
    const surgeon = makeSurgeon('Dr. X', 'EGS', { maxOcd: 3, maxOcn: 2, max24h: 2 });
    const schedule: Schedule = {
      range: RANGE,
      shifts: [
        makeShift(surgeon.id, '2026-07-02', 'OCD'),
        makeShift(surgeon.id, '2026-07-09', 'OCN'),
        makeShift(surgeon.id, '2026-07-19', '24H'),
      ],
    };
    const violations = maxLimitRule(schedule, [surgeon]);
    const maxViolations = violations.filter(v =>
      v.ruleId === 'MAX_OCD_EXCEEDED' || v.ruleId === 'MAX_OCN_EXCEEDED' || v.ruleId === 'MAX_24H_EXCEEDED',
    );
    expect(maxViolations).toHaveLength(0);
  });

  it('24H shifts do not count toward maxOcd or maxOcn', () => {
    const surgeon = makeSurgeon('Dr. X', 'EGS', { maxOcd: 0, maxOcn: 0 });
    const schedule: Schedule = {
      range: RANGE,
      shifts: [makeShift(surgeon.id, '2026-07-05', '24H')],
    };
    const violations = maxLimitRule(schedule, [surgeon]);
    const ocdOcnViolations = violations.filter(
      v => v.ruleId === 'MAX_OCD_EXCEEDED' || v.ruleId === 'MAX_OCN_EXCEEDED',
    );
    expect(ocdOcnViolations).toHaveLength(0);
  });

  it('limits are checked per calendar month — 1 per month across 2 months is fine', () => {
    const surgeon = makeSurgeon('Dr. X', 'EGS', { maxOcn: 1 });
    const schedule: Schedule = {
      range: { start: '2026-07-01', end: '2026-08-31' },
      shifts: [
        makeShift(surgeon.id, '2026-07-09', 'OCN'),  // July: 1
        makeShift(surgeon.id, '2026-08-06', 'OCN'),  // August: 1
      ],
    };
    const violations = maxLimitRule(schedule, [surgeon]);
    expect(violations.filter(v => v.ruleId === 'MAX_OCN_EXCEEDED')).toHaveLength(0);
  });

  it('flags only the month where limit is exceeded, not other months', () => {
    const surgeon = makeSurgeon('Dr. X', 'EGS', { maxOcn: 1 });
    const schedule: Schedule = {
      range: { start: '2026-07-01', end: '2026-08-31' },
      shifts: [
        makeShift(surgeon.id, '2026-07-09', 'OCN'),
        makeShift(surgeon.id, '2026-07-16', 'OCN'),  // July: 2 → violation
        makeShift(surgeon.id, '2026-08-06', 'OCN'),  // August: 1 → fine
      ],
    };
    const violations = maxLimitRule(schedule, [surgeon]);
    const exceeded = violations.filter(v => v.ruleId === 'MAX_OCN_EXCEEDED');
    expect(exceeded).toHaveLength(1);
    expect(exceeded[0].date).toMatch(/^2026-07/);
  });

  it('surgeon without max limits set does not produce violations', () => {
    const surgeon = makeSurgeon('Dr. X', 'EGS');
    const schedule: Schedule = {
      range: RANGE,
      shifts: Array.from({ length: 10 }, (_, i) =>
        makeShift(surgeon.id, `2026-07-${String(i + 1).padStart(2, '0')}`, 'OCD'),
      ),
    };
    const violations = maxLimitRule(schedule, [surgeon]);
    const maxViolations = violations.filter(v =>
      v.ruleId === 'MAX_OCD_EXCEEDED' || v.ruleId === 'MAX_OCN_EXCEEDED' || v.ruleId === 'MAX_24H_EXCEEDED',
    );
    expect(maxViolations).toHaveLength(0);
  });
});

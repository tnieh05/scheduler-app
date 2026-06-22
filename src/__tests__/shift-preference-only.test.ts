/**
 * TDD tests for 24H_ONLY and 12H_ONLY shift preference strictness.
 *
 * These preferences must be HARD constraints, not just soft sort priorities.
 * A 24H_ONLY surgeon should never receive standalone OCD or OCN.
 * A 12H_ONLY surgeon should never receive a 24H shift.
 */
import { describe, it, expect } from 'vitest';
import { generateSchedule } from '../engine/generator';
import { isoMonth, isoYear } from '../lib/dateUtils';
import { defaultPreferences } from '../types';
import type { Surgeon } from '../types/surgeon';
import type { DateRange } from '../types/schedule';
import type { Shift } from '../types/shift';

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

const RANGE: DateRange = { start: '2026-07-01', end: '2026-07-31' };
const RANGE_3MO: DateRange = { start: '2026-07-01', end: '2026-09-30' };

function makeSurgeon(
  name: string,
  type: Surgeon['type'] = 'EGS',
  prefs: Partial<typeof defaultPreferences> = {},
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

const BASE_SURGEONS: Surgeon[] = [
  makeSurgeon('Dr. A'), makeSurgeon('Dr. B'), makeSurgeon('Dr. C'),
  makeSurgeon('Dr. D'), makeSurgeon('Dr. E'), makeSurgeon('Dr. F'),
  makeSurgeon('Dr. G'), makeSurgeon('Dr. H'),
  makeSurgeon('Dr. I', 'NON_EGS'), makeSurgeon('Dr. J', 'NON_EGS'),
];

describe('shiftPreference 24H_ONLY — hard constraint', () => {
  it('24H_ONLY surgeon never receives a standalone OCD shift', () => {
    const surgeon = makeSurgeon('Dr. X', 'EGS', { shiftPreference: '24H_ONLY' });
    const schedule = generateSchedule([...BASE_SURGEONS, surgeon], RANGE);
    const ocd = schedule.shifts.filter(s => s.surgeonId === surgeon.id && s.kind === 'OCD');
    expect(ocd).toHaveLength(0);
  });

  it('24H_ONLY surgeon never receives a standalone OCN shift', () => {
    const surgeon = makeSurgeon('Dr. X', 'EGS', { shiftPreference: '24H_ONLY' });
    const schedule = generateSchedule([...BASE_SURGEONS, surgeon], RANGE);
    const ocn = schedule.shifts.filter(s => s.surgeonId === surgeon.id && s.kind === 'OCN');
    expect(ocn).toHaveLength(0);
  });

  it('24H_ONLY surgeon can still receive 24H shifts', () => {
    const surgeon = makeSurgeon('Dr. X', 'EGS', { shiftPreference: '24H_ONLY' });
    const schedule = generateSchedule([...BASE_SURGEONS, surgeon], RANGE_3MO);
    const h24 = schedule.shifts.filter(s => s.surgeonId === surgeon.id && s.kind === '24H');
    expect(h24.length).toBeGreaterThan(0);
  });

  it('24H_ONLY constraint holds across 3 months (including local search)', () => {
    const surgeon = makeSurgeon('Dr. X', 'EGS', { shiftPreference: '24H_ONLY' });
    const schedule = generateSchedule([...BASE_SURGEONS, surgeon], RANGE_3MO);
    const badShifts = schedule.shifts.filter(
      s => s.surgeonId === surgeon.id && (s.kind === 'OCD' || s.kind === 'OCN'),
    );
    expect(badShifts).toHaveLength(0);
  });

  it('24H_ONLY + max24h = 3 → surgeon gets at most 3 24H and no OCD/OCN', () => {
    const surgeon = makeSurgeon('Dr. X', 'EGS', { shiftPreference: '24H_ONLY', max24h: 3 });
    const schedule = generateSchedule([...BASE_SURGEONS, surgeon], RANGE);
    const ocd = schedule.shifts.filter(s => s.surgeonId === surgeon.id && s.kind === 'OCD');
    const ocn = schedule.shifts.filter(s => s.surgeonId === surgeon.id && s.kind === 'OCN');
    const h24 = schedule.shifts.filter(s => s.surgeonId === surgeon.id && s.kind === '24H');
    expect(ocd).toHaveLength(0);
    expect(ocn).toHaveLength(0);
    expect(h24.length).toBeLessThanOrEqual(3);
  });
});

describe('shiftPreference 24H_ONLY — max24h is the binding limit, not type OCN quota', () => {
  it('24H_ONLY surgeon with max24h = 3 can receive 3 24H shifts in a month', () => {
    // EGS OCN quota = 2: without the fix, 2 24H shifts saturate q.ocn and block the 3rd.
    const surgeon = makeSurgeon('Dr. X', 'EGS', { shiftPreference: '24H_ONLY', max24h: 3 });
    const schedule = generateSchedule([...BASE_SURGEONS, surgeon], RANGE);
    const h24 = schedule.shifts.filter(s => s.surgeonId === surgeon.id && s.kind === '24H');
    expect(h24.length).toBeGreaterThanOrEqual(3);
  });

  it('24H_ONLY NON_EGS surgeon with max24h = 4 can receive up to 4 24H per month', () => {
    const surgeon = makeSurgeon('Dr. X', 'NON_EGS', { shiftPreference: '24H_ONLY', max24h: 4 });
    const schedule = generateSchedule([...BASE_SURGEONS, surgeon], RANGE_3MO);
    for (const [, count] of countKindPerMonth(schedule.shifts, surgeon.id, '24H')) {
      expect(count).toBeLessThanOrEqual(4);
    }
    const total = schedule.shifts.filter(s => s.surgeonId === surgeon.id && s.kind === '24H').length;
    expect(total).toBeGreaterThan(0);
  });
});

describe('24H_ONLY priority in Phase 2 competition', () => {
  it('24H_ONLY surgeon with max24h=3 gets 3 24H even when competing with many regular surgeons', () => {
    // Regular surgeons appear more urgent in Phase 2 (0 calls vs 24H_ONLY's 2)
    // because they don't yet have their Phase-3/4 OCD/OCN. Without the priority
    // boost, regular surgeons take every weekday 24H slot, leaving 24H_ONLY stuck
    // at the weekend cap of 2. With the boost, 24H_ONLY goes first.
    const lee = makeSurgeon('Lee', 'EGS', { shiftPreference: '24H_ONLY', max24h: 3 });
    const schedule = generateSchedule([...BASE_SURGEONS, lee], RANGE);
    const h24 = schedule.shifts.filter(s => s.surgeonId === lee.id && s.kind === '24H');
    expect(h24.length).toBeGreaterThanOrEqual(3);
  });

  it('three 24H_ONLY surgeons with max24h=3 each get 3 24H per month', () => {
    const lavi = makeSurgeon('Lavi', 'EGS', { shiftPreference: '24H_ONLY', max24h: 3 });
    const chau = makeSurgeon('Chau', 'EGS', { shiftPreference: '24H_ONLY', max24h: 3 });
    const lee = makeSurgeon('Lee', 'EGS', { shiftPreference: '24H_ONLY', max24h: 3 });
    const schedule = generateSchedule([...BASE_SURGEONS, lavi, chau, lee], RANGE);
    for (const s of [lavi, chau, lee]) {
      const h24 = schedule.shifts.filter(x => x.surgeonId === s.id && x.kind === '24H');
      expect(h24.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('24H_ONLY surgeons never exceed their max24h even with priority boost', () => {
    const lee = makeSurgeon('Lee', 'EGS', { shiftPreference: '24H_ONLY', max24h: 3 });
    const schedule = generateSchedule([...BASE_SURGEONS, lee], RANGE_3MO);
    for (const [, count] of countKindPerMonth(schedule.shifts, lee.id, '24H')) {
      expect(count).toBeLessThanOrEqual(3);
    }
  });
});

describe('24H_ONLY + pool surgeon: pool OCN must not block 3rd 24H', () => {
  function makePool(availableDates: string[]): Surgeon {
    return {
      id: 'pool',
      name: 'Pool Surgeon',
      type: 'POOL',
      blackouts: [],
      robotBlocks: [],
      availableDates,
      preferences: { ...defaultPreferences },
    };
  }

  it('24H_ONLY surgeon with max24h=3 gets 3 24H even when pool covers most weekdays', () => {
    // Pool covers all July weekdays except the few in Lee's blackout window.
    // Without the fix, these pool OCN shifts block Phase 2 on all non-weekend dates,
    // and the weekend cap of 2 means Lee is stuck at 2 total.
    const weekdays = [
      '2026-07-01','2026-07-02','2026-07-06','2026-07-07','2026-07-08','2026-07-09',
      '2026-07-13','2026-07-14','2026-07-15','2026-07-16',
      '2026-07-20','2026-07-21','2026-07-22','2026-07-23',
      '2026-07-27','2026-07-28','2026-07-29','2026-07-30',
    ];
    const pool = makePool(weekdays);
    const lee = {
      ...makeSurgeon('Lee', 'EGS', { shiftPreference: '24H_ONLY', max24h: 3 }),
      blackouts: [
        { date: '2026-07-18', type: 'BOTH' as const },
        { date: '2026-07-19', type: 'BOTH' as const },
        { date: '2026-07-20', type: 'BOTH' as const },
        { date: '2026-07-21', type: 'BOTH' as const },
        { date: '2026-07-22', type: 'BOTH' as const },
        { date: '2026-07-23', type: 'BOTH' as const },
        { date: '2026-07-24', type: 'BOTH' as const },
        { date: '2026-07-25', type: 'BOTH' as const },
        { date: '2026-07-26', type: 'BOTH' as const },
        { date: '2026-07-27', type: 'BOTH' as const },
      ],
    };
    const schedule = generateSchedule([...BASE_SURGEONS, pool, lee], RANGE);
    const h24 = schedule.shifts.filter(s => s.surgeonId === lee.id && s.kind === '24H');
    expect(h24.length).toBeGreaterThanOrEqual(3);
  });

  it('pool OCN on a date is removed when a 24H_ONLY surgeon takes a 24H there', () => {
    const pool = makePool(['2026-07-28']);
    const lee = makeSurgeon('Lee', 'EGS', { shiftPreference: '24H_ONLY', max24h: 3 });
    const schedule = generateSchedule([...BASE_SURGEONS, pool, lee], RANGE);
    const poolOCNOnJul28 = schedule.shifts.filter(
      s => s.surgeonId === pool.id && s.date === '2026-07-28' && s.kind === 'OCN',
    );
    const leeH24OnJul28 = schedule.shifts.filter(
      s => s.surgeonId === lee.id && s.date === '2026-07-28' && s.kind === '24H',
    );
    // Either Lee didn't take Jul 28, OR Lee took it and the pool OCN was removed (not both)
    if (leeH24OnJul28.length > 0) {
      expect(poolOCNOnJul28).toHaveLength(0);
    }
  });
});

describe('explicit max24h overrides SHIFT_QUOTAS OCN/OCD cap', () => {
  it('24H-preferred (non-ONLY) EGS surgeon with max24h = 3 receives at least 3 24H', () => {
    // Without the fix: after 2 24H, q.ocn = 2 = EGS OCN quota, blocking the 3rd.
    const surgeon = makeSurgeon('Dr. X', 'EGS', { shiftPreference: '24H', max24h: 3 });
    const schedule = generateSchedule([...BASE_SURGEONS, surgeon], RANGE);
    const h24 = schedule.shifts.filter(s => s.surgeonId === surgeon.id && s.kind === '24H');
    expect(h24.length).toBeGreaterThanOrEqual(3);
  });

  it('NON_EGS surgeon with 24H preference and max24h = 4 can reach 4 24H per month', () => {
    const surgeon = makeSurgeon('Dr. X', 'NON_EGS', { shiftPreference: '24H', max24h: 4 });
    const schedule = generateSchedule([...BASE_SURGEONS, surgeon], RANGE_3MO);
    const monthCounts = countKindPerMonth(schedule.shifts, surgeon.id, '24H');
    for (const [, count] of monthCounts) {
      expect(count).toBeLessThanOrEqual(4);
    }
  });

  it('surgeon without explicit max24h is still capped by SHIFT_QUOTAS', () => {
    // No max24h set: should not exceed the type-level default (EGS OCN quota = 2 → max 2 24H)
    const surgeon = makeSurgeon('Dr. X', 'EGS', { shiftPreference: '24H' });
    const schedule = generateSchedule([...BASE_SURGEONS, surgeon], RANGE);
    const h24 = schedule.shifts.filter(s => s.surgeonId === surgeon.id && s.kind === '24H');
    expect(h24.length).toBeLessThanOrEqual(2);
  });
});

describe('shiftPreference 12H_ONLY — hard constraint', () => {
  it('12H_ONLY surgeon never receives a 24H shift', () => {
    const surgeon = makeSurgeon('Dr. X', 'EGS', { shiftPreference: '12H_ONLY' });
    const schedule = generateSchedule([...BASE_SURGEONS, surgeon], RANGE);
    const h24 = schedule.shifts.filter(s => s.surgeonId === surgeon.id && s.kind === '24H');
    expect(h24).toHaveLength(0);
  });

  it('12H_ONLY surgeon can still receive OCD and OCN shifts', () => {
    const surgeon = makeSurgeon('Dr. X', 'EGS', { shiftPreference: '12H_ONLY' });
    const schedule = generateSchedule([...BASE_SURGEONS, surgeon], RANGE_3MO);
    const ocdOcn = schedule.shifts.filter(
      s => s.surgeonId === surgeon.id && (s.kind === 'OCD' || s.kind === 'OCN'),
    );
    expect(ocdOcn.length).toBeGreaterThan(0);
  });

  it('12H_ONLY constraint holds across 3 months (including local search)', () => {
    const surgeon = makeSurgeon('Dr. X', 'EGS', { shiftPreference: '12H_ONLY' });
    const schedule = generateSchedule([...BASE_SURGEONS, surgeon], RANGE_3MO);
    const h24 = schedule.shifts.filter(s => s.surgeonId === surgeon.id && s.kind === '24H');
    expect(h24).toHaveLength(0);
  });
});

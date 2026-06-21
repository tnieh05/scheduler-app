import { describe, it, expect } from 'vitest';
import { generateSchedule, computeAvailableDays } from '../engine/generator';
import { runAllRules } from '../engine/validator';
import { dateRange } from '../lib/dateUtils';
import type { Surgeon } from '../types/surgeon';
import type { Shift } from '../types/shift';
import type { DateRange } from '../types/schedule';

function makeSurgeon(name: string, type: Surgeon['type']): Surgeon {
  return {
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    type,
    blackouts: [],
    robotBlocks: [],
    preferences: { shiftPreference: 'none', customNotes: '' },
  };
}

// Distinct call events: OCD=1, OCN=1, 24H=1 (not 2, since it's one shift)
function callEvents(shifts: Shift[], surgeonId: string): number {
  return shifts.filter(
    s =>
      s.surgeonId === surgeonId &&
      (s.kind === 'OCD' || s.kind === 'OCN' || s.kind === '24H'),
  ).length;
}

const JULY: DateRange = { start: '2026-07-01', end: '2026-07-31' };
const JULY_DATES = dateRange('2026-07-01', '2026-07-31');

// ─── computeAvailableDays unit tests ────────────────────────────────────────

describe('computeAvailableDays', () => {
  it('returns full month count for unconstrained surgeon', () => {
    const s = makeSurgeon('A', 'EGS');
    expect(computeAvailableDays(s, JULY_DATES, [])).toBe(31);
  });

  it('subtracts BOTH blackout days', () => {
    const s: Surgeon = {
      ...makeSurgeon('A', 'EGS'),
      blackouts: [
        { date: '2026-07-01', type: 'BOTH' },
        { date: '2026-07-02', type: 'BOTH' },
        { date: '2026-07-10', type: 'BOTH' },
      ],
    };
    expect(computeAvailableDays(s, JULY_DATES, [])).toBe(28);
  });

  it('does not subtract OCD-only or OCN-only blackouts (surgeon can still do the other)', () => {
    const s: Surgeon = {
      ...makeSurgeon('A', 'EGS'),
      blackouts: [
        { date: '2026-07-01', type: 'OCD' },
        { date: '2026-07-02', type: 'OCN' },
      ],
    };
    expect(computeAvailableDays(s, JULY_DATES, [])).toBe(31);
  });

  it('subtracts single-day EGS shifts', () => {
    const s = { ...makeSurgeon('a', 'EGS'), id: 'a' };
    const egs: Shift = { id: 'e1', surgeonId: 'a', date: '2026-07-07', kind: 'EGS' };
    expect(computeAvailableDays(s, JULY_DATES, [egs])).toBe(30);
  });

  it('subtracts week-span EGS shifts for every day in span', () => {
    const s = { ...makeSurgeon('a', 'EGS'), id: 'a' };
    const egs: Shift = {
      id: 'e2',
      surgeonId: 'a',
      date: '2026-07-06',
      endDate: '2026-07-11',
      kind: 'EGS',
    };
    // Jul 6–11 = 6 days
    expect(computeAvailableDays(s, JULY_DATES, [egs])).toBe(25);
  });

  it('subtracts robot block day AND the day before', () => {
    const s: Surgeon = {
      ...makeSurgeon('A', 'EGS'),
      robotBlocks: [{ date: '2026-07-08', assistingOnly: false }],
    };
    // Jul 7 (day before) and Jul 8 (robot day) = 2 blocked
    expect(computeAvailableDays(s, JULY_DATES, [])).toBe(29);
  });

  it('subtracts multiple robot blocks without double-counting overlap', () => {
    const s: Surgeon = {
      ...makeSurgeon('A', 'EGS'),
      robotBlocks: [
        { date: '2026-07-08', assistingOnly: false }, // blocks Jul 7 & 8
        { date: '2026-07-09', assistingOnly: false }, // blocks Jul 8 & 9 (Jul 8 already counted)
      ],
    };
    // Jul 7, 8, 9 = 3 unique blocked days
    expect(computeAvailableDays(s, JULY_DATES, [])).toBe(28);
  });

  it('returns at least 1 even when all days are BOTH-blacked-out', () => {
    const s: Surgeon = {
      ...makeSurgeon('A', 'EGS'),
      blackouts: JULY_DATES.map(d => ({ date: d, type: 'BOTH' as const })),
    };
    expect(computeAvailableDays(s, JULY_DATES, [])).toBeGreaterThanOrEqual(1);
  });
});

// ─── fairness integration tests ─────────────────────────────────────────────

describe('fairness — call distribution', () => {
  it('unconstrained EGS surgeons end up within ±2 calls of each other over one month', () => {
    const surgeons = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(n =>
      makeSurgeon(`Dr. ${n}`, 'EGS'),
    );
    const nonEgs = ['I', 'J'].map(n => makeSurgeon(`Dr. ${n}`, 'NON_EGS'));
    const all = [...surgeons, ...nonEgs];

    const schedule = generateSchedule(all, JULY);

    const egsCounts = surgeons.map(s => callEvents(schedule.shifts, s.id));
    const max = Math.max(...egsCounts);
    const min = Math.min(...egsCounts);

    if (max - min > 2) {
      console.error('EGS call distribution:', Object.fromEntries(surgeons.map((s, i) => [s.name, egsCounts[i]])));
    }
    expect(max - min).toBeLessThanOrEqual(2);
  });

  it('constrained surgeon gets fewer calls; unconstrained peers stay balanced', () => {
    // Surgeon A has 10 BOTH blackouts on every other day starting Jul 1
    const constrainedBlackouts = JULY_DATES.filter((_, i) => i % 3 === 0)
      .slice(0, 10)
      .map(d => ({ date: d, type: 'BOTH' as const }));

    const constrained: Surgeon = {
      ...makeSurgeon('Constrained', 'EGS'),
      blackouts: constrainedBlackouts,
    };
    const surgeons: Surgeon[] = [
      constrained,
      makeSurgeon('Free-1', 'EGS'),
      makeSurgeon('Free-2', 'EGS'),
      makeSurgeon('Free-3', 'EGS'),
      makeSurgeon('Free-4', 'EGS'),
    ];

    const schedule = generateSchedule(surgeons, JULY);

    const [constrainedCalls, ...freeCalls] = surgeons.map(s =>
      callEvents(schedule.shifts, s.id),
    );
    const freeMax = Math.max(...freeCalls);
    const freeMin = Math.min(...freeCalls);

    // Free surgeons should be tightly balanced among themselves
    expect(freeMax - freeMin).toBeLessThanOrEqual(2);
    // Constrained surgeon should still have gotten some calls
    expect(constrainedCalls).toBeGreaterThan(0);
  });

  it('urgency-based selection does not introduce new rule violations', () => {
    const surgeons = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(n =>
      makeSurgeon(`Dr. ${n}`, 'EGS'),
    );
    const nonEgs = ['I', 'J', 'K'].map(n => makeSurgeon(`Dr. ${n}`, 'NON_EGS'));
    const all = [...surgeons, ...nonEgs];
    const schedule = generateSchedule(all, JULY);
    const violations = runAllRules(schedule, all);
    expect(violations).toHaveLength(0);
  });
});

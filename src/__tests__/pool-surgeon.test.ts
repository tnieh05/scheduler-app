/**
 * TDD tests for Pool surgeon OCN-only behavior.
 *
 * Pool surgeons do OCN only (not 24H).
 * - Their availableDates produce OCN shifts, not 24H shifts.
 * - OCD coverage on pool dates must still be filled by a regular surgeon.
 * - Pool OCN satisfies the OCN slot; no second OCN should be placed.
 * - No 24H shifts should ever be assigned to a pool surgeon.
 */
import { describe, it, expect } from 'vitest';
import { generateSchedule } from '../engine/generator';
import { runAllRules } from '../engine/validator';
import { coverageRule } from '../engine/rules/coverage';
import { reducer, initialState } from '../store/reducer';
import type { Surgeon } from '../types/surgeon';
import type { Shift } from '../types/shift';
import type { Schedule, DateRange } from '../types/schedule';
import { v4 as uuidv4 } from 'uuid';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeSurgeon(name: string, type: Surgeon['type'], extra: Partial<Surgeon> = {}): Surgeon {
  return {
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    type,
    blackouts: [],
    robotBlocks: [],
    preferences: { shiftPreference: 'none', customNotes: '' },
    ...extra,
  };
}

function makeShift(surgeonId: string, date: string, kind: Shift['kind']): Shift {
  return { id: uuidv4(), surgeonId, date, kind };
}

const RANGE: DateRange = { start: '2026-07-01', end: '2026-07-31' };

const ACTIVE_SURGEONS: Surgeon[] = [
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
];

const POOL = makeSurgeon('Pool', 'POOL', { availableDates: ['2026-07-07', '2026-07-15', '2026-07-23'] });

// ─── Coverage rule ──────────────────────────────────────────────────────────

describe('coverageRule — pool OCN shifts', () => {
  it('pool OCN + regular OCD satisfies full coverage', () => {
    const schedule: Schedule = {
      range: { start: '2026-07-05', end: '2026-07-05' },
      shifts: [
        makeShift('pool', '2026-07-05', 'OCN'),
        makeShift('dr-a', '2026-07-05', 'OCD'),
      ],
    };
    const violations = coverageRule(schedule, []);
    expect(violations).toHaveLength(0);
  });

  it('pool OCN with no OCD → COVERAGE_GAP for OCD', () => {
    const schedule: Schedule = {
      range: { start: '2026-07-05', end: '2026-07-05' },
      shifts: [
        makeShift('pool', '2026-07-05', 'OCN'),
      ],
    };
    const violations = coverageRule(schedule, []);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toMatch(/OCD/);
  });

  it('pool OCN does not create an OCN gap violation', () => {
    const schedule: Schedule = {
      range: { start: '2026-07-05', end: '2026-07-05' },
      shifts: [
        makeShift('pool', '2026-07-05', 'OCN'),
        makeShift('dr-a', '2026-07-05', 'OCD'),
      ],
    };
    const violations = coverageRule(schedule, []);
    const ocnViolations = violations.filter(v => v.message.includes('OCN'));
    expect(ocnViolations).toHaveLength(0);
  });
});

// ─── Generator ──────────────────────────────────────────────────────────────

describe('generateSchedule — pool surgeon OCN only', () => {
  const allSurgeons = [...ACTIVE_SURGEONS, POOL];

  it('pool surgeon never receives a 24H shift', () => {
    const schedule = generateSchedule(allSurgeons, RANGE);
    const pool24H = schedule.shifts.filter(s => s.surgeonId === POOL.id && s.kind === '24H');
    expect(pool24H).toHaveLength(0);
  });

  it('pool surgeon availableDates produce OCN shifts', () => {
    const schedule = generateSchedule(allSurgeons, RANGE);
    for (const date of POOL.availableDates ?? []) {
      const poolShift = schedule.shifts.find(s => s.surgeonId === POOL.id && s.date === date);
      expect(poolShift).toBeDefined();
      expect(poolShift?.kind).toBe('OCN');
    }
  });

  it('pool OCN dates still have OCD coverage from a regular surgeon', () => {
    const schedule = generateSchedule(allSurgeons, RANGE);
    for (const date of POOL.availableDates ?? []) {
      const hasOCD = schedule.shifts.some(
        s => s.date === date && s.kind === 'OCD',
      );
      const has24H = schedule.shifts.some(
        s => s.date === date && s.kind === '24H',
      );
      expect(hasOCD || has24H).toBe(true);
    }
  });

  it('produces no rule violations with pool surgeon doing OCN', () => {
    const schedule = generateSchedule(allSurgeons, RANGE);
    const violations = runAllRules(schedule, allSurgeons);
    if (violations.length > 0) {
      console.error(violations.map(v => `[${v.ruleId}] ${v.message}`).join('\n'));
    }
    expect(violations).toHaveLength(0);
  });
});

// ─── Reducer ────────────────────────────────────────────────────────────────

describe('reducer — pool surgeon UPDATE_SURGEON', () => {
  function stateWithSchedule(shifts: Shift[]): typeof initialState {
    return {
      ...initialState,
      surgeons: [
        makeSurgeon('Dr. A', 'EGS'),
        makeSurgeon('Pool', 'POOL', { availableDates: [] }),
      ],
      schedule: { range: RANGE, shifts },
      hasGenerated: true,
    };
  }

  const poolSurgeon = makeSurgeon('Pool', 'POOL', { availableDates: ['2026-07-05'] });

  it('UPDATE_SURGEON for POOL creates OCN shifts from availableDates', () => {
    const state = stateWithSchedule([]);
    const next = reducer(state, { type: 'UPDATE_SURGEON', payload: poolSurgeon });
    const poolShifts = next.schedule?.shifts.filter(s => s.surgeonId === poolSurgeon.id) ?? [];
    expect(poolShifts).toHaveLength(1);
    expect(poolShifts[0].kind).toBe('OCN');
    expect(poolShifts[0].date).toBe('2026-07-05');
  });

  it('UPDATE_SURGEON for POOL does not create 24H shifts', () => {
    const state = stateWithSchedule([]);
    const next = reducer(state, { type: 'UPDATE_SURGEON', payload: poolSurgeon });
    const h24 = next.schedule?.shifts.filter(s => s.surgeonId === poolSurgeon.id && s.kind === '24H') ?? [];
    expect(h24).toHaveLength(0);
  });

  it('UPDATE_SURGEON for POOL removes other OCN/24H on the same date but keeps OCD', () => {
    const regularOCD = makeShift('dr-a', '2026-07-05', 'OCD');
    const regularOCN = makeShift('dr-a', '2026-07-05', 'OCN');
    const state = stateWithSchedule([regularOCD, regularOCN]);
    const next = reducer(state, { type: 'UPDATE_SURGEON', payload: poolSurgeon });

    const shifts = next.schedule?.shifts ?? [];
    // OCD stays
    expect(shifts.some(s => s.id === regularOCD.id)).toBe(true);
    // Other OCN removed (pool covers OCN slot)
    expect(shifts.some(s => s.id === regularOCN.id)).toBe(false);
  });

  it('DELETE_SHIFT for pool OCN removes date from availableDates', () => {
    const poolOCN: Shift = { id: 'pool-ocn-1', surgeonId: poolSurgeon.id, date: '2026-07-05', kind: 'OCN' };
    const state = {
      ...stateWithSchedule([poolOCN]),
      surgeons: [
        makeSurgeon('Dr. A', 'EGS'),
        { ...poolSurgeon, availableDates: ['2026-07-05'] },
      ],
    };
    const next = reducer(state, { type: 'DELETE_SHIFT', payload: { shiftId: 'pool-ocn-1' } });
    const pool = next.surgeons.find(s => s.id === poolSurgeon.id);
    expect(pool?.availableDates).not.toContain('2026-07-05');
  });
});

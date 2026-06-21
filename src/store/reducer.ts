import { v4 as uuidv4 } from 'uuid';
import type { Surgeon } from '../types/surgeon';
import type { Shift, AncillaryKind } from '../types/shift';
import type { Schedule, DateRange } from '../types/schedule';
import type { Violation } from '../types/violation';
import type { Action } from './actions';
import { runAllRules } from '../engine/validator';
import { addDays } from '../lib/dateUtils';
import { defaultPreferences } from '../types/surgeon';

export interface AppState {
  surgeons: Surgeon[];
  schedule: Schedule | null;
  violations: Violation[];
  selectedRange: DateRange;
  activeTab: 'manual' | 'import';
  highlightedShiftId: string | null;
  highlightedDate: string | null;
  isGenerating: boolean;
  hasGenerated: boolean; // true after first Generate; gates conflict display
  selectedSurgeonId: string | null;
  parseErrors: string[];
  activeMonth: string; // "YYYY-MM" — currently viewed month
  rawScheduleFile: string | null; // raw KP block CSV text, used as export template
}

function defaultRange(): DateRange {
  const today = new Date();
  const start = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  // 3 months out
  const endDate = new Date(today.getFullYear(), today.getMonth() + 3, 0);
  const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
  return { start, end };
}

function defaultMonth(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
}

const pref = { ...defaultPreferences };

const DEFAULT_SURGEONS: Surgeon[] = [
  { id: uuidv4(), name: 'Chen',         type: 'NON_EGS', blackouts: [], robotBlocks: [], preferences: pref },
  { id: uuidv4(), name: 'Douaiher',     type: 'NON_EGS', blackouts: [], robotBlocks: [], preferences: pref },
  { id: uuidv4(), name: 'Amog',         type: 'EGS',     blackouts: [], robotBlocks: [], preferences: pref },
  { id: uuidv4(), name: 'Bell',         type: 'EGS',     blackouts: [], robotBlocks: [], preferences: pref },
  { id: uuidv4(), name: 'Chakedis',     type: 'EGS',     blackouts: [], robotBlocks: [], preferences: pref },
  { id: uuidv4(), name: 'Chau',         type: 'EGS',     blackouts: [], robotBlocks: [], preferences: pref },
  { id: uuidv4(), name: 'Chin',         type: 'EGS',     blackouts: [], robotBlocks: [], preferences: pref },
  { id: uuidv4(), name: 'Greif',        type: 'EGS',     blackouts: [], robotBlocks: [], preferences: pref },
  { id: uuidv4(), name: 'Lavi',         type: 'EGS',     blackouts: [], robotBlocks: [], preferences: pref },
  { id: uuidv4(), name: 'Lee',          type: 'EGS',     blackouts: [], robotBlocks: [], preferences: pref },
  { id: uuidv4(), name: 'Singh',        type: 'EGS',     blackouts: [], robotBlocks: [], preferences: pref },
  { id: uuidv4(), name: 'Pool Surgeon', type: 'POOL',    blackouts: [], robotBlocks: [], preferences: pref, availableDates: [] },
];

function defaultSchedule(): Schedule {
  return { range: defaultRange(), shifts: [] };
}

export const initialState: AppState = {
  surgeons: DEFAULT_SURGEONS,
  schedule: defaultSchedule(),
  violations: [],
  selectedRange: defaultRange(),
  activeTab: 'manual',
  highlightedShiftId: null,
  highlightedDate: null,
  isGenerating: false,
  hasGenerated: false,
  selectedSurgeonId: null,
  parseErrors: [],
  activeMonth: defaultMonth(),
  rawScheduleFile: null,
};

function revalidate(schedule: Schedule, surgeons: Surgeon[], hasGenerated: boolean): Violation[] {
  if (!hasGenerated) return [];
  return runAllRules(schedule, surgeons);
}

const SURGEON_TYPE_ORDER: Record<string, number> = { NON_EGS: 0, EGS: 1, POOL: 2 };

function sortSurgeons(surgeons: Surgeon[]): Surgeon[] {
  return [...surgeons].sort(
    (a, b) => (SURGEON_TYPE_ORDER[a.type] ?? 99) - (SURGEON_TYPE_ORDER[b.type] ?? 99),
  );
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ADD_SURGEONS': {
      const surgeons = sortSurgeons([...state.surgeons, ...action.payload]);
      // Auto-init an empty schedule so the calendar renders and POOL shifts can be placed
      const schedule = state.schedule ?? { range: state.selectedRange, shifts: [] };
      return { ...state, surgeons, schedule, parseErrors: [] };
    }

    case 'UPDATE_SURGEON': {
      const surgeons = state.surgeons.map(s =>
        s.id === action.payload.id ? action.payload : s,
      );

      let schedule = state.schedule;

      // For pool surgeons: sync 24H shifts to match their availableDates, then
      // clear non-pool call shifts on any date a pool surgeon has a 24H.
      if (state.schedule && action.payload.type === 'POOL') {
        const poolId = action.payload.id;
        const { range } = state.schedule;
        const allPoolIds = new Set(surgeons.filter(s => s.type === 'POOL').map(s => s.id));

        // Replace this pool surgeon's OCN shifts with the updated availableDates.
        // Pool surgeons cover the OCN slot only; OCD must come from regular surgeons.
        const inRange = (action.payload.availableDates ?? []).filter(
          d => d >= range.start && d <= range.end,
        );
        let shifts: Shift[] = state.schedule.shifts.filter(
          s => !(s.surgeonId === poolId && s.kind === 'OCN'),
        );
        for (const date of inRange) {
          shifts.push({
            id: uuidv4(),
            surgeonId: poolId,
            date,
            kind: 'OCN',
            ancillaries: ['PRECALL_AM', 'POSTCALL_PM'] as AncillaryKind[],
          });
        }

        // Pool covers OCN only — remove other OCN/24H on those dates, but keep OCD
        const poolOCNDates = new Set(
          shifts.filter(s => allPoolIds.has(s.surgeonId) && s.kind === 'OCN').map(s => s.date),
        );
        shifts = shifts.filter(s =>
          allPoolIds.has(s.surgeonId) ||
          !poolOCNDates.has(s.date) ||
          (s.kind !== 'OCN' && s.kind !== '24H'),
        );

        schedule = { ...state.schedule, shifts };
      }

      const violations = schedule ? revalidate(schedule, surgeons, state.hasGenerated) : [];
      return { ...state, surgeons, schedule, violations };
    }

    case 'REMOVE_SURGEON': {
      const surgeons = state.surgeons.filter(s => s.id !== action.payload.id);
      const schedule = state.schedule
        ? {
            ...state.schedule,
            shifts: state.schedule.shifts.filter(s => s.surgeonId !== action.payload.id),
          }
        : null;
      return {
        ...state,
        surgeons,
        schedule,
        violations: schedule ? revalidate(schedule, surgeons, state.hasGenerated) : [],
        selectedSurgeonId: state.selectedSurgeonId === action.payload.id ? null : state.selectedSurgeonId,
      };
    }

    case 'SET_SCHEDULE': {
      const violations = revalidate(action.payload, state.surgeons, true);
      return { ...state, schedule: action.payload, violations, isGenerating: false, hasGenerated: true };
    }

    case 'MOVE_SHIFT': {
      if (!state.schedule) return state;
      const shifts = state.schedule.shifts.map(s =>
        s.id === action.payload.shiftId
          ? { ...s, surgeonId: action.payload.newSurgeonId, date: action.payload.newDate, pinned: true }
          : s,
      );
      const schedule = { ...state.schedule, shifts };
      return { ...state, schedule, violations: revalidate(schedule, state.surgeons, state.hasGenerated) };
    }

    case 'SWAP_SHIFTS': {
      if (!state.schedule) return state;
      const a = state.schedule.shifts.find(s => s.id === action.payload.shiftIdA);
      const b = state.schedule.shifts.find(s => s.id === action.payload.shiftIdB);
      if (!a || !b) return state;
      const shifts = state.schedule.shifts.map(s => {
        if (s.id === a.id) return { ...s, surgeonId: b.surgeonId, date: b.date, pinned: true };
        if (s.id === b.id) return { ...s, surgeonId: a.surgeonId, date: a.date, pinned: true };
        return s;
      });
      const schedule = { ...state.schedule, shifts };
      return { ...state, schedule, violations: revalidate(schedule, state.surgeons, state.hasGenerated) };
    }

    case 'ADD_SHIFT': {
      if (!state.schedule) return state;
      const poolIds = new Set(state.surgeons.filter(s => s.type === 'POOL').map(s => s.id));
      let shifts = [...state.schedule.shifts, action.payload];
      let surgeons = state.surgeons;

      if (poolIds.has(action.payload.surgeonId) && action.payload.kind === 'OCN') {
        const { date, surgeonId } = action.payload;
        // Pool OCN covers the OCN slot only — remove other OCN/24H, but keep OCD
        shifts = shifts.filter(s =>
          poolIds.has(s.surgeonId) ||
          s.date !== date ||
          (s.kind !== 'OCN' && s.kind !== '24H'),
        );
        // Keep availableDates in sync so Generate picks up this date
        surgeons = state.surgeons.map(s => {
          if (s.id !== surgeonId || s.type !== 'POOL') return s;
          const dates = [...new Set([...(s.availableDates ?? []), date])].sort();
          return { ...s, availableDates: dates };
        });
      }

      const schedule = { ...state.schedule, shifts };
      return { ...state, surgeons, schedule, violations: revalidate(schedule, surgeons, state.hasGenerated) };
    }

    case 'DELETE_SHIFT': {
      if (!state.schedule) return state;
      const deleted = state.schedule.shifts.find(s => s.id === action.payload.shiftId);
      const shifts = state.schedule.shifts.filter(s => s.id !== action.payload.shiftId);
      let surgeons = state.surgeons;

      // If a pool OCN was removed, drop its date from availableDates
      if (deleted?.kind === 'OCN') {
        const pool = state.surgeons.find(s => s.id === deleted.surgeonId && s.type === 'POOL');
        if (pool) {
          surgeons = state.surgeons.map(s =>
            s.id === pool.id
              ? { ...s, availableDates: (s.availableDates ?? []).filter(d => d !== deleted.date) }
              : s,
          );
        }
      }

      const schedule = { ...state.schedule, shifts };
      return { ...state, surgeons, schedule, violations: revalidate(schedule, surgeons, state.hasGenerated) };
    }

    case 'SET_RANGE':
      return { ...state, selectedRange: action.payload, activeMonth: action.payload.start.slice(0, 7) };

    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };

    case 'SET_HIGHLIGHTED_SHIFT':
      return { ...state, highlightedShiftId: action.payload.shiftId, highlightedDate: action.payload.date };

    case 'SET_IS_GENERATING':
      return { ...state, isGenerating: action.payload };

    case 'SET_PARSE_ERRORS':
      return { ...state, parseErrors: action.payload };

    case 'SET_ACTIVE_MONTH':
      return { ...state, activeMonth: action.payload };

    case 'SET_SURGEONS':
      return {
        ...state,
        surgeons: action.payload,
        schedule: null,
        violations: [],
      };

    case 'CLEAR_SCHEDULE': {
      const surgeons = state.surgeons.map(s => ({
        ...s,
        blackouts: [],
        robotBlocks: [],
        ...(s.type === 'POOL' ? { availableDates: [] } : {}),
      }));
      const schedule = state.schedule
        ? { ...state.schedule, shifts: [] }
        : { range: state.selectedRange, shifts: [] };
      return { ...state, surgeons, schedule, violations: [], hasGenerated: false, selectedSurgeonId: null };
    }

    case 'SELECT_SURGEON':
      return { ...state, selectedSurgeonId: action.payload };

    case 'REPLACE_EGS_SHIFTS': {
      if (!state.schedule) return state;
      const { surgeonId, rangeStart, rangeEnd, egsShifts } = action.payload;
      const kept = state.schedule.shifts.filter(
        s => !(s.surgeonId === surgeonId && s.kind === 'EGS' && s.date >= rangeStart && s.date <= rangeEnd),
      );
      const shifts = [...kept, ...egsShifts];
      const schedule = { ...state.schedule, shifts };
      return { ...state, schedule, violations: revalidate(schedule, state.surgeons, state.hasGenerated) };
    }

    case 'TOGGLE_PIN_SHIFT': {
      if (!state.schedule) return state;
      const shifts = state.schedule.shifts.map(s =>
        s.id === action.payload.shiftId ? { ...s, pinned: !s.pinned } : s,
      );
      const schedule = { ...state.schedule, shifts };
      return { ...state, schedule };
    }

    case 'SET_RAW_SCHEDULE_FILE':
      return { ...state, rawScheduleFile: action.payload };

    case 'LOAD_SAVED_SCHEDULE': {
      const { schedule, surgeons, selectedRange } = action.payload;
      const violations = revalidate(schedule, surgeons, true);
      return {
        ...state,
        schedule,
        surgeons,
        selectedRange,
        violations,
        hasGenerated: true,
        activeMonth: selectedRange.start.slice(0, 7),
        selectedSurgeonId: null,
        highlightedShiftId: null,
        highlightedDate: null,
      };
    }

    default:
      return state;
  }
}

// Derive prev/next valid month within range
export function prevMonth(current: string, rangeStart: string): string | null {
  const [y, m] = current.split('-').map(Number);
  const prev = m === 1
    ? `${y - 1}-12`
    : `${y}-${String(m - 1).padStart(2, '0')}`;
  return prev >= rangeStart.slice(0, 7) ? prev : null;
}

export function nextMonth(current: string, rangeEnd: string): string | null {
  const [y, m] = current.split('-').map(Number);
  const next = m === 12
    ? `${y + 1}-01`
    : `${y}-${String(m + 1).padStart(2, '0')}`;
  return next <= rangeEnd.slice(0, 7) ? next : null;
}

void addDays; // imported for potential future use

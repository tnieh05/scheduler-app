import type { Surgeon } from '../types/surgeon';
import type { Shift } from '../types/shift';
import type { Schedule, DateRange } from '../types/schedule';
import type { SavedSchedule } from '../types/savedSchedule';

export type Action =
  | { type: 'ADD_SURGEONS'; payload: Surgeon[] }
  | { type: 'UPDATE_SURGEON'; payload: Surgeon }
  | { type: 'REMOVE_SURGEON'; payload: { id: string } }
  | { type: 'SET_SCHEDULE'; payload: Schedule }
  | { type: 'MOVE_SHIFT'; payload: { shiftId: string; newSurgeonId: string; newDate: string } }
  | { type: 'SWAP_SHIFTS'; payload: { shiftIdA: string; shiftIdB: string } }
  | { type: 'ADD_SHIFT'; payload: Shift }
  | { type: 'DELETE_SHIFT'; payload: { shiftId: string } }
  | { type: 'SET_RANGE'; payload: DateRange }
  | { type: 'SET_ACTIVE_TAB'; payload: 'manual' | 'import' }
  | { type: 'SET_HIGHLIGHTED_SHIFT'; payload: { shiftId: string | null; date: string | null } }
  | { type: 'SET_IS_GENERATING'; payload: boolean }
  | { type: 'SET_PARSE_ERRORS'; payload: string[] }
  | { type: 'SET_ACTIVE_MONTH'; payload: string } // "YYYY-MM"
  | { type: 'SET_SURGEONS'; payload: Surgeon[] } // replace entire roster
  | { type: 'REPLACE_EGS_SHIFTS'; payload: { surgeonId: string; rangeStart: string; rangeEnd: string; egsShifts: Shift[] } }
  | { type: 'CLEAR_SCHEDULE' }
  | { type: 'SELECT_SURGEON'; payload: string | null }
  | { type: 'TOGGLE_PIN_SHIFT'; payload: { shiftId: string } }
  | { type: 'SET_RAW_SCHEDULE_FILE'; payload: string | null }
  | { type: 'LOAD_SAVED_SCHEDULE'; payload: SavedSchedule };

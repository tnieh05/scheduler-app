import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import { reducer, initialState, type AppState } from './reducer';
import type { Action } from './actions';
import { runAllRules } from '../engine/validator';
import { DEFAULT_RULES } from '../constants/scheduleRules';

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextValue | null>(null);

const STORAGE_KEY = 'scheduler_state_v1';

// Fields that should survive a page refresh. Violations are intentionally not
// persisted — they're recomputed from the restored schedule on load.
type PersistedState = Pick<
  AppState,
  | 'surgeons'
  | 'schedule'
  | 'selectedRange'
  | 'activeMonth'
  | 'activeTab'
  | 'hasGenerated'
  | 'rawScheduleFile'
  | 'importedRange'
  | 'rules'
>;

function loadPersistedState(): Partial<PersistedState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<PersistedState>;
  } catch {
    return {};
  }
}

function buildInitialState(): AppState {
  const saved = loadPersistedState();
  const state: AppState = {
    ...initialState,
    ...(saved.surgeons !== undefined && { surgeons: saved.surgeons }),
    ...(saved.schedule !== undefined && { schedule: saved.schedule }),
    ...(saved.selectedRange !== undefined && { selectedRange: saved.selectedRange }),
    ...(saved.activeMonth !== undefined && { activeMonth: saved.activeMonth }),
    ...(saved.activeTab !== undefined && ['manual', 'import'].includes(saved.activeTab) && { activeTab: saved.activeTab as 'manual' | 'import' }),
    ...(saved.hasGenerated !== undefined && { hasGenerated: saved.hasGenerated }),
    ...(saved.rawScheduleFile !== undefined && { rawScheduleFile: saved.rawScheduleFile }),
    ...(saved.importedRange !== undefined && { importedRange: saved.importedRange }),
    // Spread over defaults so rule fields added in future versions get their
    // default value instead of being undefined in older persisted state.
    ...(saved.rules !== undefined && { rules: { ...DEFAULT_RULES, ...saved.rules } }),
  };
  // Violations aren't persisted — recompute them from the restored schedule.
  state.violations =
    state.hasGenerated && state.schedule
      ? runAllRules(state.schedule, state.surgeons, state.rules)
      : [];
  return state;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, buildInitialState);

  // Persist relevant state whenever it changes.
  useEffect(() => {
    const toSave: PersistedState = {
      surgeons: state.surgeons,
      schedule: state.schedule,
      selectedRange: state.selectedRange,
      activeMonth: state.activeMonth,
      activeTab: state.activeTab,
      hasGenerated: state.hasGenerated,
      rawScheduleFile: state.rawScheduleFile,
      importedRange: state.importedRange,
      rules: state.rules,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      // Quota exceeded or private-browsing restriction — silently ignore.
    }
  }, [state.surgeons, state.schedule, state.selectedRange, state.activeMonth, state.activeTab, state.hasGenerated, state.rawScheduleFile, state.importedRange, state.rules]);

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useAppState(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx;
}

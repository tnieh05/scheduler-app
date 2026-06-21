import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import { reducer, initialState, type AppState } from './reducer';
import type { Action } from './actions';

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextValue | null>(null);

const STORAGE_KEY = 'scheduler_state_v1';

// Fields that should survive a page refresh.
type PersistedState = Pick<
  AppState,
  'surgeons' | 'schedule' | 'violations' | 'selectedRange' | 'activeMonth' | 'activeTab' | 'hasGenerated'
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
  return {
    ...initialState,
    ...(saved.surgeons !== undefined && { surgeons: saved.surgeons }),
    ...(saved.schedule !== undefined && { schedule: saved.schedule }),
    ...(saved.violations !== undefined && { violations: saved.violations }),
    ...(saved.selectedRange !== undefined && { selectedRange: saved.selectedRange }),
    ...(saved.activeMonth !== undefined && { activeMonth: saved.activeMonth }),
    ...(saved.activeTab !== undefined && ['manual', 'import'].includes(saved.activeTab) && { activeTab: saved.activeTab as 'manual' | 'import' }),
    ...(saved.hasGenerated !== undefined && { hasGenerated: saved.hasGenerated }),
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, buildInitialState);

  // Persist relevant state whenever it changes.
  useEffect(() => {
    const toSave: PersistedState = {
      surgeons: state.surgeons,
      schedule: state.schedule,
      violations: state.violations,
      selectedRange: state.selectedRange,
      activeMonth: state.activeMonth,
      activeTab: state.activeTab,
      hasGenerated: state.hasGenerated,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      // Quota exceeded or private-browsing restriction — silently ignore.
    }
  }, [state.surgeons, state.schedule, state.violations, state.selectedRange, state.activeMonth, state.activeTab, state.hasGenerated]);

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useAppState(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx;
}

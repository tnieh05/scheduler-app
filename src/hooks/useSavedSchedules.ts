import { useSyncExternalStore } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { SavedSchedule } from '../types/savedSchedule';
import type { Schedule, DateRange } from '../types/schedule';
import type { Surgeon } from '../types/surgeon';
import type { ScheduleRules } from '../constants/scheduleRules';

const STORAGE_KEY = 'scheduler:saved-schedules';

// Module-level store shared by every component that uses this hook, so a save
// from one component (e.g. SaveScheduleButton) updates all others (e.g. the
// History badge in the Header) immediately.
let saves: SavedSchedule[] = load();
const listeners = new Set<() => void>();

function load(): SavedSchedule[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

// Returns null on success, or an error message if persisting failed
// (most commonly QuotaExceededError when localStorage is full).
function persist(next: SavedSchedule[]): string | null {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return null;
  } catch {
    return 'Storage is full — delete some saved schedules and try again.';
  }
}

function setSaves(next: SavedSchedule[]): string | null {
  const error = persist(next);
  if (error) return error;
  saves = next;
  listeners.forEach(fn => fn());
  return null;
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot(): SavedSchedule[] {
  return saves;
}

export function useSavedSchedules() {
  const current = useSyncExternalStore(subscribe, getSnapshot);

  function save(
    name: string,
    schedule: Schedule,
    surgeons: Surgeon[],
    selectedRange: DateRange,
    rules?: ScheduleRules,
  ): { entry: SavedSchedule | null; error: string | null } {
    const entry: SavedSchedule = {
      id: uuidv4(),
      name: name.trim() || 'Untitled schedule',
      savedAt: new Date().toISOString(),
      schedule,
      surgeons,
      selectedRange,
      rules,
    };
    const error = setSaves([entry, ...saves]);
    return error ? { entry: null, error } : { entry, error: null };
  }

  function remove(id: string) {
    setSaves(saves.filter(s => s.id !== id));
  }

  function rename(id: string, name: string) {
    setSaves(saves.map(s => (s.id === id ? { ...s, name: name.trim() || s.name } : s)));
  }

  return { saves: current, save, remove, rename };
}

import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { SavedSchedule } from '../types/savedSchedule';
import type { Schedule, DateRange } from '../types/schedule';
import type { Surgeon } from '../types/surgeon';

const STORAGE_KEY = 'scheduler:saved-schedules';

function load(): SavedSchedule[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function persist(saves: SavedSchedule[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
}

export function useSavedSchedules() {
  const [saves, setSaves] = useState<SavedSchedule[]>(load);

  function save(name: string, schedule: Schedule, surgeons: Surgeon[], selectedRange: DateRange) {
    const entry: SavedSchedule = {
      id: uuidv4(),
      name: name.trim() || 'Untitled schedule',
      savedAt: new Date().toISOString(),
      schedule,
      surgeons,
      selectedRange,
    };
    setSaves(prev => {
      const next = [entry, ...prev];
      persist(next);
      return next;
    });
    return entry;
  }

  function remove(id: string) {
    setSaves(prev => {
      const next = prev.filter(s => s.id !== id);
      persist(next);
      return next;
    });
  }

  function rename(id: string, name: string) {
    setSaves(prev => {
      const next = prev.map(s => s.id === id ? { ...s, name: name.trim() || s.name } : s);
      persist(next);
      return next;
    });
  }

  return { saves, save, remove, rename };
}

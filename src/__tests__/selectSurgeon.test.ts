import { describe, it, expect } from 'vitest';
import { reducer, initialState } from '../store/reducer';

describe('SELECT_SURGEON', () => {
  it('initialState has null selectedSurgeonId', () => {
    expect(initialState.selectedSurgeonId).toBeNull();
  });

  it('sets selectedSurgeonId', () => {
    const next = reducer(initialState, { type: 'SELECT_SURGEON', payload: 'surgeon-1' });
    expect(next.selectedSurgeonId).toBe('surgeon-1');
  });

  it('calling again with same id keeps selection', () => {
    const s1 = reducer(initialState, { type: 'SELECT_SURGEON', payload: 'surgeon-1' });
    const s2 = reducer(s1, { type: 'SELECT_SURGEON', payload: 'surgeon-1' });
    expect(s2.selectedSurgeonId).toBe('surgeon-1');
  });

  it('clicking a different surgeon switches selection', () => {
    const s1 = reducer(initialState, { type: 'SELECT_SURGEON', payload: 'surgeon-1' });
    const s2 = reducer(s1, { type: 'SELECT_SURGEON', payload: 'surgeon-2' });
    expect(s2.selectedSurgeonId).toBe('surgeon-2');
  });

  it('CLEAR_SCHEDULE resets selectedSurgeonId to null', () => {
    const s1 = reducer(initialState, { type: 'SELECT_SURGEON', payload: 'surgeon-1' });
    const s2 = reducer(s1, { type: 'CLEAR_SCHEDULE' });
    expect(s2.selectedSurgeonId).toBeNull();
  });

  it('REMOVE_SURGEON for the selected surgeon resets selection to null', () => {
    const surgeonId = initialState.surgeons[0].id;
    const s1 = reducer(initialState, { type: 'SELECT_SURGEON', payload: surgeonId });
    const s2 = reducer(s1, { type: 'REMOVE_SURGEON', payload: { id: surgeonId } });
    expect(s2.selectedSurgeonId).toBeNull();
  });

  it('REMOVE_SURGEON for a different surgeon keeps current selection', () => {
    const [first, second] = initialState.surgeons;
    const s1 = reducer(initialState, { type: 'SELECT_SURGEON', payload: first.id });
    const s2 = reducer(s1, { type: 'REMOVE_SURGEON', payload: { id: second.id } });
    expect(s2.selectedSurgeonId).toBe(first.id);
  });
});

describe('activeTab — import tab removed from left panel', () => {
  it('initialState defaults to manual tab', () => {
    expect(initialState.activeTab).toBe('manual');
  });

  it('SET_ACTIVE_TAB manual still works', () => {
    const s1 = reducer(initialState, { type: 'SET_ACTIVE_TAB', payload: 'import' });
    const s2 = reducer(s1, { type: 'SET_ACTIVE_TAB', payload: 'manual' });
    expect(s2.activeTab).toBe('manual');
  });
});

describe('delete surgeon flow', () => {
  it('deleting selected surgeon removes them from the roster and clears selection', () => {
    const target = initialState.surgeons[2]; // Amog
    const s1 = reducer(initialState, { type: 'SELECT_SURGEON', payload: target.id });
    const s2 = reducer(s1, { type: 'REMOVE_SURGEON', payload: { id: target.id } });

    expect(s2.surgeons.find(s => s.id === target.id)).toBeUndefined();
    expect(s2.selectedSurgeonId).toBeNull();
  });

  it('deleting selected surgeon removes their shifts from the schedule', () => {
    if (!initialState.schedule) return;
    const target = initialState.surgeons[0];
    // Manually inject a shift for the target surgeon
    const fakeShift = {
      id: 'shift-1',
      surgeonId: target.id,
      date: '2026-07-01',
      kind: 'OCD' as const,
    };
    const stateWithShift = {
      ...initialState,
      schedule: { ...initialState.schedule, shifts: [fakeShift] },
    };
    const s1 = reducer(stateWithShift, { type: 'SELECT_SURGEON', payload: target.id });
    const s2 = reducer(s1, { type: 'REMOVE_SURGEON', payload: { id: target.id } });

    expect(s2.schedule?.shifts.find(s => s.surgeonId === target.id)).toBeUndefined();
  });
});

import { useAppState } from '../../store/AppContext';
import { generateSchedule } from '../../engine/generator';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export function GenerateButton() {
  const { state, dispatch } = useAppState();
  const { surgeons, schedule, selectedRange, isGenerating } = state;

  async function handleGenerate() {
    if (surgeons.length === 0 || isGenerating) return;
    dispatch({ type: 'SET_IS_GENERATING', payload: true });
    dispatch({ type: 'SET_GENERATE_ERROR', payload: null });

    try {
      const response = await fetch(`${API_URL}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surgeons,
          range: selectedRange,
          existingShifts: schedule?.shifts ?? [],
          rules: state.rules,
        }),
      });

      // 422 = the solver understood the request and proved it unsolvable
      // (e.g. pinned shifts that conflict with a hard rule). The local
      // generator would hit the same wall, so surface the message instead
      // of silently falling back and appearing to do nothing.
      if (response.status === 422) {
        const err = await response.json().catch(() => ({ detail: response.statusText }));
        dispatch({
          type: 'SET_GENERATE_ERROR',
          payload: typeof err.detail === 'string' ? err.detail : 'The solver could not find a valid schedule.',
        });
        return;
      }

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(typeof err.detail === 'string' ? err.detail : response.statusText);
      }

      const { shifts } = await response.json();
      dispatch({ type: 'SET_SCHEDULE', payload: { range: selectedRange, shifts } });
    } catch (err) {
      console.warn('API solver unavailable, falling back to local generator:', err);
      try {
        const next = generateSchedule(surgeons, selectedRange, schedule ?? undefined, state.rules);
        dispatch({ type: 'SET_SCHEDULE', payload: next });
      } catch (fallbackErr) {
        console.error('Local generator also failed:', fallbackErr);
        dispatch({
          type: 'SET_GENERATE_ERROR',
          payload: fallbackErr instanceof Error ? fallbackErr.message : 'Schedule generation failed.',
        });
      }
    }
  }

  return (
    <button
      onClick={handleGenerate}
      disabled={surgeons.length === 0 || isGenerating}
      className="bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-medium h-8 px-4 rounded transition-colors"
    >
      {isGenerating ? 'Generating…' : 'Generate Schedule'}
    </button>
  );
}

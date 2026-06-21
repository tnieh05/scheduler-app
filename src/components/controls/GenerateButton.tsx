import { useAppState } from '../../store/AppContext';
import { generateSchedule } from '../../engine/generator';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export function GenerateButton() {
  const { state, dispatch } = useAppState();
  const { surgeons, schedule, selectedRange, isGenerating } = state;

  async function handleGenerate() {
    if (surgeons.length === 0 || isGenerating) return;
    dispatch({ type: 'SET_IS_GENERATING', payload: true });

    try {
      const response = await fetch(`${API_URL}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surgeons,
          range: selectedRange,
          existingShifts: schedule?.shifts ?? [],
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(typeof err.detail === 'string' ? err.detail : response.statusText);
      }

      const { shifts } = await response.json();
      dispatch({ type: 'SET_SCHEDULE', payload: { range: selectedRange, shifts } });
    } catch (err) {
      console.warn('API solver unavailable, falling back to local generator:', err);
      const next = generateSchedule(surgeons, selectedRange, schedule ?? undefined);
      dispatch({ type: 'SET_SCHEDULE', payload: next });
    }
  }

  return (
    <button
      onClick={handleGenerate}
      disabled={surgeons.length === 0 || isGenerating}
      className="bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-1.5 rounded transition-colors"
    >
      {isGenerating ? 'Generating…' : 'Generate Schedule'}
    </button>
  );
}

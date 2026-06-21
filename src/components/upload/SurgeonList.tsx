import type { Surgeon } from '../../types';
import { useAppState } from '../../store/AppContext';

interface Props {
  onEdit: (surgeon: Surgeon) => void;
}

export function SurgeonList({ onEdit }: Props) {
  const { state, dispatch } = useAppState();
  const { surgeons } = state;

  if (surgeons.length === 0) {
    return (
      <p className="text-slate-400 text-xs text-center py-2">
        No surgeons loaded yet.
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {surgeons.map(s => (
        <li key={s.id} className="flex items-center justify-between px-2 py-1.5 bg-slate-50 rounded text-sm">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                s.type === 'EGS'
                  ? 'bg-teal-100 text-teal-700'
                  : s.type === 'POOL'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {s.type === 'EGS' ? 'EGS' : s.type === 'POOL' ? 'Pool' : 'Non-EGS'}
            </span>
            <span className="truncate text-slate-700">{s.name}</span>
            {/* POOL: show available date count */}
            {s.type === 'POOL' && (
              <span className="text-[10px] px-1 py-0.5 rounded bg-yellow-100 text-yellow-700 shrink-0">
                {(s.availableDates ?? []).length} dates
              </span>
            )}
            {/* Preference badge (non-POOL) */}
            {s.type !== 'POOL' && s.preferences?.shiftPreference === '24H' && (
              <span className="text-[10px] px-1 py-0.5 rounded bg-blue-100 text-blue-700 shrink-0">24H pref</span>
            )}
            {s.type !== 'POOL' && s.preferences?.shiftPreference === '24H_ONLY' && (
              <span className="text-[10px] px-1 py-0.5 rounded bg-blue-200 text-blue-800 shrink-0 font-semibold">24H only</span>
            )}
            {s.type !== 'POOL' && s.preferences?.shiftPreference === '12H' && (
              <span className="text-[10px] px-1 py-0.5 rounded bg-orange-100 text-orange-700 shrink-0">12H pref</span>
            )}
            {s.type !== 'POOL' && s.preferences?.shiftPreference === '12H_ONLY' && (
              <span className="text-[10px] px-1 py-0.5 rounded bg-orange-200 text-orange-800 shrink-0 font-semibold">12H only</span>
            )}
          </div>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            <button
              onClick={() => onEdit(s)}
              className="text-slate-300 hover:text-blue-400 transition-colors text-xs"
              title="Edit surgeon"
            >
              ✎
            </button>
            <button
              onClick={() => dispatch({ type: 'REMOVE_SURGEON', payload: { id: s.id } })}
              className="text-slate-300 hover:text-red-400 transition-colors text-xs"
              title="Remove surgeon"
            >
              ✕
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

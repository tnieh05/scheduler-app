import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppState } from '../../store/AppContext';

function ClearModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-xl w-80 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-800">Clear everything?</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          This will permanently remove:
        </p>
        <ul className="text-xs text-slate-600 space-y-1.5 list-none">
          {[
            'All shift assignments (OCD, OCN, 24H, EGS)',
            'Imported blackout dates',
            'Robot block dates',
            'Pool surgeon available dates',
          ].map(item => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-0.5 text-slate-400">·</span>
              {item}
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-400">Surgeon names and date range are kept.</p>
        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 py-1.5 text-xs rounded border border-slate-200 text-slate-500 hover:border-slate-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-1.5 text-xs font-medium rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
          >
            Clear everything
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function ClearButton() {
  const { state, dispatch } = useAppState();
  const [open, setOpen] = useState(false);

  const hasAnything =
    (state.schedule?.shifts.length ?? 0) > 0 ||
    state.surgeons.some(
      s => s.blackouts.length > 0 || s.robotBlocks.length > 0 || (s.availableDates ?? []).length > 0,
    );

  function handleConfirm() {
    dispatch({ type: 'CLEAR_SCHEDULE' });
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={!hasAnything}
        className="text-slate-500 hover:text-slate-700 disabled:text-slate-300 disabled:cursor-not-allowed text-sm font-medium px-3 py-1.5 rounded border border-slate-200 hover:border-slate-300 disabled:border-slate-100 transition-colors"
      >
        Clear
      </button>
      {open && <ClearModal onConfirm={handleConfirm} onCancel={() => setOpen(false)} />}
    </>
  );
}

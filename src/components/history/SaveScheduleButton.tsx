import { useState, useRef, useEffect } from 'react';
import { useAppState } from '../../store/AppContext';
import { useSavedSchedules } from '../../hooks/useSavedSchedules';

export function SaveScheduleButton() {
  const { state } = useAppState();
  const { save } = useSavedSchedules();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const canSave = !!state.schedule && state.hasGenerated;

  useEffect(() => {
    if (open) {
      // Pre-fill with a sensible default name
      const { start, end } = state.schedule?.range ?? { start: '', end: '' };
      setName(`Schedule ${start} – ${end}`);
      setSaved(false);
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [open]);

  function handleSave() {
    if (!state.schedule) return;
    save(name, state.schedule, state.surgeons, state.selectedRange);
    setSaved(true);
    setTimeout(() => setOpen(false), 800);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') setOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => canSave && setOpen(o => !o)}
        disabled={!canSave}
        className="w-full border border-slate-300 hover:border-slate-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 text-sm px-3 py-1.5 rounded transition-colors"
      >
        Save
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Popover */}
          <div className="absolute right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-lg shadow-lg p-3 w-72">
            {saved ? (
              <p className="text-xs text-green-600 font-medium text-center py-1">Saved!</p>
            ) : (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-600">Schedule name</label>
                <input
                  ref={inputRef}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="e.g. June 2026 schedule"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setOpen(false)}
                    className="flex-1 py-1.5 text-xs rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex-1 py-1.5 text-xs font-medium rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

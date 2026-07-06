import { useState } from 'react';
import { useAppState } from '../../store/AppContext';
import { RulesModal } from './RulesModal';
import { downloadScheduleCsv } from '../../lib/downloadScheduleCsv';
import { DEFAULT_RULES } from '../../constants/scheduleRules';

export function OverflowMenu() {
  const { state } = useAppState();
  const [open, setOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  const canExport = !!state.schedule;
  const rulesModified = (Object.keys(DEFAULT_RULES) as (keyof typeof DEFAULT_RULES)[]).some(
    k => state.rules[k] !== DEFAULT_RULES[k],
  );

  function handleExport() {
    if (!state.schedule) return;
    downloadScheduleCsv(state.schedule, state.surgeons, state.rawScheduleFile);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative border text-slate-600 text-sm h-8 w-8 rounded transition-colors hover:bg-slate-50"
        style={{ borderColor: '#ABB5BB' }}
        title="More options"
      >
        ⋮
        {rulesModified && (
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-blue-500" title="Custom rules active" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1 w-48">
            <button
              onClick={handleExport}
              disabled={!canExport}
              className="w-full text-left px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed transition-colors"
            >
              Export CSV
            </button>
            <button
              onClick={() => { setOpen(false); setRulesOpen(true); }}
              className="w-full text-left px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-between"
            >
              Schedule Rules…
              {rulesModified && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
            </button>
          </div>
        </>
      )}

      {rulesOpen && <RulesModal onClose={() => setRulesOpen(false)} />}
    </div>
  );
}

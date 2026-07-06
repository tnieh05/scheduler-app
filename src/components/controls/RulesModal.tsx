import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppState } from '../../store/AppContext';
import { DEFAULT_RULES, type ScheduleRules } from '../../constants/scheduleRules';

interface FieldDef {
  key: keyof ScheduleRules;
  label: string;
  help: string;
  min: number;
  max: number;
}

const FIELDS: FieldDef[] = [
  { key: 'restWindowDays', label: 'Rest window (days)', help: 'Days off after each call shift', min: 1, max: 7 },
  { key: 'maxCallsPerWeek', label: 'Max calls per week', help: 'OCD, OCN, or 24H each count as 1', min: 1, max: 7 },
  { key: 'maxWeekendShiftsPerMonth', label: 'Max weekend calls per month', help: 'Weekend = Fri, Sat, Sun', min: 0, max: 15 },
  { key: 'monthlyMax24h', label: 'Default max 24H per month', help: 'Per-surgeon limits override this', min: 0, max: 31 },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function RulesModal({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useAppState();
  const [draft, setDraft] = useState<ScheduleRules>({ ...state.rules });

  function setField(key: keyof ScheduleRules, def: FieldDef, raw: string) {
    const parsed = parseInt(raw, 10);
    if (Number.isNaN(parsed)) return;
    setDraft(d => ({ ...d, [key]: clamp(parsed, def.min, def.max) }));
  }

  function handleApply() {
    dispatch({ type: 'SET_RULES', payload: draft });
    onClose();
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-96 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Schedule Rules</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors text-lg leading-none"
            title="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          {FIELDS.map(def => (
            <div key={def.key} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <label className="block text-xs font-medium text-slate-600">{def.label}</label>
                <p className="text-[11px] text-slate-400">{def.help}</p>
              </div>
              <input
                type="number"
                min={def.min}
                max={def.max}
                step={1}
                value={draft[def.key]}
                onChange={e => setField(def.key, def, e.target.value)}
                className="w-16 shrink-0 border border-slate-300 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          ))}
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Changes apply the next time you generate; conflicts update right away.
        </p>

        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => setDraft({ ...DEFAULT_RULES })}
            className="text-xs text-blue-500 hover:underline"
          >
            Reset to defaults
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="py-1.5 px-3 text-xs rounded border text-slate-500 hover:bg-slate-50 transition-colors"
              style={{ borderColor: '#ABB5BB' }}
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="py-1.5 px-3 text-xs font-medium rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

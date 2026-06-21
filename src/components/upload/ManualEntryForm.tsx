import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Surgeon, BlackoutDate, SurgeonType, SurgeonPreferences } from '../../types';
import { defaultPreferences } from '../../types';
import { useAppState } from '../../store/AppContext';

interface BlackoutEntry { date: string; type: BlackoutDate['type'] }
interface RobotEntry { date: string; assistingOnly: boolean }

const MAX_POOL_DATES = 6;

interface Props {
  initialSurgeon?: Surgeon;
  onSaved?: () => void;
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
        active
          ? 'bg-blue-500 text-white border-blue-500'
          : 'bg-white text-slate-600 border-slate-300 hover:border-blue-300'
      }`}
    >
      {children}
    </button>
  );
}

export function ManualEntryForm({ initialSurgeon, onSaved }: Props) {
  const { dispatch } = useAppState();
  const isEditing = !!initialSurgeon;

  // Initialize directly from props — no useEffect needed because the parent
  // sets key={surgeon.id}, so React fully remounts this component on each switch.
  const [name, setName] = useState(initialSurgeon?.name ?? '');
  const [type, setType] = useState<SurgeonType>(initialSurgeon?.type ?? 'EGS');
  const [blackouts, setBlackouts] = useState<BlackoutEntry[]>(
    initialSurgeon?.blackouts.map(b => ({ date: b.date, type: b.type })) ?? [],
  );
  const [robots, setRobots] = useState<RobotEntry[]>(
    initialSurgeon?.robotBlocks.map(r => ({ date: r.date, assistingOnly: r.assistingOnly })) ?? [],
  );
  const [prefs, setPrefs] = useState<SurgeonPreferences>(
    initialSurgeon?.preferences
      ? { ...defaultPreferences, ...initialSurgeon.preferences }
      : { ...defaultPreferences },
  );
  const [availableDates, setAvailableDates] = useState<string[]>(
    initialSurgeon?.availableDates ?? [],
  );
  const [error, setError] = useState('');
  const [savedStatus, setSavedStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const isFirstRender = useRef(true);

  // Auto-save when editing an existing surgeon
  useEffect(() => {
    if (!isEditing) return;
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (!name.trim()) return;

    setSavedStatus('saving');
    const timer = setTimeout(() => {
      const validBlackouts: BlackoutDate[] = blackouts
        .filter(b => /^\d{4}-\d{2}-\d{2}$/.test(b.date.trim()))
        .map(b => ({ date: b.date.trim(), type: b.type }));
      const validRobots = robots
        .filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r.date.trim()))
        .map(r => ({ date: r.date.trim(), assistingOnly: r.assistingOnly }));
      const validAvailableDates = availableDates
        .map(d => d.trim())
        .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));

      const surgeon: Surgeon = {
        id: initialSurgeon!.id,
        name: name.trim(),
        type,
        blackouts: type === 'POOL' ? [] : validBlackouts,
        robotBlocks: type === 'POOL' ? [] : validRobots,
        preferences: prefs,
        ...(type === 'POOL' ? { availableDates: validAvailableDates } : {}),
      };
      dispatch({ type: 'UPDATE_SURGEON', payload: surgeon });
      setSavedStatus('saved');
      setTimeout(() => setSavedStatus('idle'), 1500);
    }, 600);

    return () => clearTimeout(timer);
  }, [name, type, blackouts, robots, prefs, availableDates]);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) { setError('Name is required'); return; }

    const validBlackouts: BlackoutDate[] = blackouts
      .filter(b => /^\d{4}-\d{2}-\d{2}$/.test(b.date.trim()))
      .map(b => ({ date: b.date.trim(), type: b.type }));
    const validRobots = robots
      .filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r.date.trim()))
      .map(r => ({ date: r.date.trim(), assistingOnly: r.assistingOnly }));
    const validAvailableDates = availableDates
      .map(d => d.trim())
      .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));

    const surgeon: Surgeon = {
      id: uuidv4(),
      name: trimmed,
      type,
      blackouts: type === 'POOL' ? [] : validBlackouts,
      robotBlocks: type === 'POOL' ? [] : validRobots,
      preferences: prefs,
      ...(type === 'POOL' ? { availableDates: validAvailableDates } : {}),
    };

    dispatch({ type: 'ADD_SURGEONS', payload: [surgeon] });
    setName('');
    setType('EGS');
    setBlackouts([]);
    setRobots([]);
    setPrefs({ ...defaultPreferences });
    setAvailableDates([]);
    setError('');
    onSaved?.();
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-red-500 text-xs">{error}</p>}

      {/* Name — locked when editing an existing surgeon */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
        {isEditing ? (
          <div className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm bg-slate-50 text-slate-700 select-none">
            {name}
          </div>
        ) : (
          <input
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Dr. Jane Smith"
          />
        )}
      </div>

      {/* Type */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
        <div className="flex gap-3">
          {(['EGS', 'NON_EGS', 'POOL'] as SurgeonType[]).map(t => (
            <label key={t} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                checked={type === t}
                onChange={() => setType(t)}
                className="accent-blue-500"
              />
              <span className="text-sm">
                {t === 'EGS' ? 'EGS' : t === 'NON_EGS' ? 'Non-EGS' : 'Pool'}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Preferences — not shown for POOL since they only do OCN */}
      {type !== 'POOL' && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">Preferences</label>
          <div className="space-y-2">
            {/* Shift type preference — row 1: type */}
            {(() => {
              const pref = prefs.shiftPreference;
              const shiftType = pref === 'none' ? 'none' : pref.replace('_ONLY', '') as '24H' | '12H';
              const isStrict = pref.endsWith('_ONLY');
              return (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Shift type</span>
                    <div className="flex gap-1">
                      {(['none', '24H', '12H'] as const).map(opt => (
                        <ToggleButton
                          key={opt}
                          active={shiftType === opt}
                          onClick={() => {
                            if (opt === 'none') {
                              setPrefs(p => ({ ...p, shiftPreference: 'none' }));
                            } else {
                              setPrefs(p => ({
                                ...p,
                                shiftPreference: (isStrict ? `${opt}_ONLY` : opt) as SurgeonPreferences['shiftPreference'],
                              }));
                            }
                          }}
                        >
                          {opt === 'none' ? 'No pref' : opt}
                        </ToggleButton>
                      ))}
                    </div>
                  </div>
                  {/* Row 2: strictness — only visible when a type is selected */}
                  {shiftType !== 'none' && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Strictness</span>
                      <div className="flex gap-1">
                        {([false, true] as const).map(strict => (
                          <ToggleButton
                            key={String(strict)}
                            active={isStrict === strict}
                            onClick={() =>
                              setPrefs(p => ({
                                ...p,
                                shiftPreference: (strict ? `${shiftType}_ONLY` : shiftType) as SurgeonPreferences['shiftPreference'],
                              }))
                            }
                          >
                            {strict ? 'Only' : 'Preferred'}
                          </ToggleButton>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            {/* Custom notes */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Notes <span className="text-slate-400">(visible to scheduler, not used by generator)</span></label>
              <textarea
                className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 resize-none"
                rows={2}
                value={prefs.customNotes}
                onChange={e => setPrefs(p => ({ ...p, customNotes: e.target.value }))}
                placeholder="e.g. Prefers Thursdays, avoid school holidays…"
              />
            </div>
          </div>
        </div>
      )}

      {/* POOL: available dates (up to 6, each becomes OCN) */}
      {type === 'POOL' && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <div>
              <label className="text-xs font-medium text-slate-600">Available Dates</label>
              <span className="ml-1 text-xs text-slate-400">({availableDates.length}/{MAX_POOL_DATES}) — each becomes an OCN shift</span>
            </div>
            {availableDates.length < MAX_POOL_DATES && (
              <button
                type="button"
                onClick={() => setAvailableDates(prev => [...prev, ''])}
                className="text-xs text-blue-500 hover:underline"
              >
                + Add date
              </button>
            )}
          </div>
          {availableDates.length === 0 && (
            <p className="text-xs text-slate-400">No dates entered. Add up to 6 dates when this surgeon is available.</p>
          )}
          {availableDates.map((d, i) => (
            <div key={i} className="flex gap-2 mb-1">
              <input
                type="date"
                value={d}
                onChange={e => setAvailableDates(prev => prev.map((x, j) => j === i ? e.target.value : x))}
                className="flex-1 border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
              />
              <button
                type="button"
                onClick={() => setAvailableDates(prev => prev.filter((_, j) => j !== i))}
                className="text-slate-400 hover:text-red-400 text-xs"
              >✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Non-POOL: blackout dates */}
      {type !== 'POOL' && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-600">Blackout Dates</label>
            <button
              type="button"
              onClick={() => setBlackouts(prev => [...prev, { date: '', type: 'BOTH' }])}
              className="text-xs text-blue-500 hover:underline"
            >
              + Add
            </button>
          </div>
          {blackouts.map((b, i) => (
            <div key={i} className="flex gap-2 mb-1">
              <input
                type="date"
                value={b.date}
                onChange={e => setBlackouts(prev => prev.map((x, j) => j === i ? { ...x, date: e.target.value } : x))}
                className="flex-1 border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
              />
              <select
                value={b.type}
                onChange={e => setBlackouts(prev => prev.map((x, j) => j === i ? { ...x, type: e.target.value as BlackoutDate['type'] } : x))}
                className="border border-slate-300 rounded px-1 py-1 text-xs focus:outline-none"
              >
                <option value="OCD">OCD</option>
                <option value="OCN">OCN</option>
                <option value="BOTH">Both</option>
              </select>
              <button
                type="button"
                onClick={() => setBlackouts(prev => prev.filter((_, j) => j !== i))}
                className="text-slate-400 hover:text-red-400 text-xs"
              >✕</button>
            </div>
          ))}
          {blackouts.length === 0 && (
            <p className="text-xs text-slate-400">No blackout dates. ATO and NO CALL days should be added here.</p>
          )}
        </div>
      )}

      {/* Non-POOL: robot blocks */}
      {type !== 'POOL' && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-600">Robot Blocks</label>
            <button
              type="button"
              onClick={() => setRobots(prev => [...prev, { date: '', assistingOnly: false }])}
              className="text-xs text-blue-500 hover:underline"
            >
              + Add
            </button>
          </div>
          {robots.map((r, i) => (
            <div key={i} className="flex gap-2 mb-1 items-center">
              <input
                type="date"
                value={r.date}
                onChange={e => setRobots(prev => prev.map((x, j) => j === i ? { ...x, date: e.target.value } : x))}
                className="flex-1 border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
              />
              <label className="flex items-center gap-1 text-xs text-slate-600 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={r.assistingOnly}
                  onChange={e => setRobots(prev => prev.map((x, j) => j === i ? { ...x, assistingOnly: e.target.checked } : x))}
                  className="accent-blue-500"
                />
                Assist only
              </label>
              <button
                type="button"
                onClick={() => setRobots(prev => prev.filter((_, j) => j !== i))}
                className="text-slate-400 hover:text-red-400 text-xs"
              >✕</button>
            </div>
          ))}
        </div>
      )}

      {isEditing ? (
        <div className="h-7 flex items-center gap-1.5">
          {savedStatus === 'saving' && (
            <svg
              className="animate-spin h-3.5 w-3.5 text-slate-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          )}
          <span
            className={`text-xs transition-opacity duration-300 ${
              savedStatus === 'saved' ? 'text-green-600 opacity-100' : 'opacity-0'
            }`}
          >
            Saved
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={submit}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium py-2 rounded transition-colors"
        >
          Add Surgeon
        </button>
      )}
    </div>
  );
}

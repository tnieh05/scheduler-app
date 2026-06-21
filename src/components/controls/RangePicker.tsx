import { useAppState } from '../../store/AppContext';
import { firstOfMonth, lastOfMonth } from '../../lib/dateUtils';

function buildMonthOptions(): { value: string; label: string }[] {
  const now = new Date();
  // Floor: current month (never earlier than today's month)
  const startYear = now.getFullYear();
  const startMonth = now.getMonth(); // 0-indexed
  const options: { value: string; label: string }[] = [];
  for (let i = 0; i < 36; i++) {
    const d = new Date(startYear, startMonth + i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const value = `${y}-${String(m).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    options.push({ value, label });
  }
  return options;
}

const MONTH_OPTIONS = buildMonthOptions();

export function RangePicker() {
  const { state, dispatch } = useAppState();
  const startYM = state.selectedRange.start.slice(0, 7);
  const endYM = state.selectedRange.end.slice(0, 7);

  function handleStart(value: string) {
    const [y, m] = value.split('-').map(Number);
    const start = firstOfMonth(y, m);
    // End must not be before new start
    const newEndYM = endYM < value ? value : endYM;
    const [ey, em] = newEndYM.split('-').map(Number);
    dispatch({ type: 'SET_RANGE', payload: { start, end: lastOfMonth(ey, em) } });
  }

  function handleEnd(value: string) {
    const [y, m] = value.split('-').map(Number);
    const end = lastOfMonth(y, m);
    // Start must not be after new end
    const newStartYM = startYM > value ? value : startYM;
    const [sy, sm] = newStartYM.split('-').map(Number);
    dispatch({ type: 'SET_RANGE', payload: { start: firstOfMonth(sy, sm), end } });
  }

  const selectClass =
    'text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer hover:border-slate-300';

  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-500">
      <span className="font-medium text-slate-400">Range</span>
      <select
        value={startYM}
        onChange={e => handleStart(e.target.value)}
        className={selectClass}
      >
        {MONTH_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="text-slate-300">—</span>
      <select
        value={endYM}
        onChange={e => handleEnd(e.target.value)}
        className={selectClass}
      >
        {MONTH_OPTIONS.filter(o => o.value >= startYM).map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

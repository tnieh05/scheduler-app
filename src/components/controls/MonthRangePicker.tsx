import { useAppState } from '../../store/AppContext';
import { firstOfMonth, lastOfMonth, monthLabel } from '../../lib/dateUtils';
import { prevMonth, nextMonth } from '../../store/reducer';

export function MonthRangePicker() {
  const { state, dispatch } = useAppState();
  const { activeMonth, selectedRange } = state;

  const prev = prevMonth(activeMonth, selectedRange.start);
  const next = nextMonth(activeMonth, selectedRange.end);

  const [y, m] = activeMonth.split('-').map(Number);
  const label = monthLabel(firstOfMonth(y, m));

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => prev && dispatch({ type: 'SET_ACTIVE_MONTH', payload: prev })}
        disabled={!prev}
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600"
      >
        ‹
      </button>
      <span className="text-sm font-medium text-slate-700 min-w-[120px] text-center">{label}</span>
      <button
        onClick={() => next && dispatch({ type: 'SET_ACTIVE_MONTH', payload: next })}
        disabled={!next}
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600"
      >
        ›
      </button>
    </div>
  );
}

void lastOfMonth; // used in AppContext indirectly

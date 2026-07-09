import { useAppState } from '../../store/AppContext';
import { ClearButton } from '../controls/ClearButton';
import { GenerateButton } from '../controls/GenerateButton';
import { MonthRangePicker } from '../controls/MonthRangePicker';
import { RangePicker } from '../controls/RangePicker';

function GenerateErrorBanner() {
  const { state, dispatch } = useAppState();
  if (!state.generateError) return null;
  return (
    <div className="flex items-center gap-2 min-w-0 max-w-xl px-2.5 py-1 rounded bg-red-50 border border-red-200 text-red-700 text-xs">
      <span className="truncate" title={state.generateError}>{state.generateError}</span>
      <button
        onClick={() => dispatch({ type: 'SET_GENERATE_ERROR', payload: null })}
        className="shrink-0 text-red-400 hover:text-red-600 font-bold leading-none"
        aria-label="Dismiss error"
      >
        ×
      </button>
    </div>
  );
}

export function ScheduleToolbar() {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200 shrink-0">
      <div className="flex items-center gap-4">
        <RangePicker />
        <div className="w-px h-5 bg-slate-200" />
        <MonthRangePicker />
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <GenerateErrorBanner />
        <ClearButton />
        <GenerateButton />
      </div>
    </div>
  );
}

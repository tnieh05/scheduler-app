import type { Violation } from '../../types/violation';
import { useAppState } from '../../store/AppContext';

interface Props {
  violation: Violation;
}

const RULE_LABELS: Record<string, string> = {
  BLACKOUT_OCD: 'OCD Blackout',
  BLACKOUT_OCN: 'OCN Blackout',
  BLACKOUT_BOTH: 'Blackout',
  EGS_OVERLAP: 'EGS Overlap',
  REST_PERIOD: 'Rest Period',
  ROBOT_BLOCK: 'Robot Block',
  WEEKEND_LIMIT: 'Weekend Limit',
  CONSECUTIVE_WEEKEND: 'Consecutive Weekends',
  QUOTA_EXCEEDED: 'Quota Exceeded',
  PRECALL_MISSING: 'Precall Missing',
  POSTCALL_MISSING: 'Postcall Missing',
};

export function ViolationCard({ violation }: Props) {
  const { dispatch } = useAppState();

  function highlight() {
    dispatch({
      type: 'SET_HIGHLIGHTED_SHIFT',
      payload: { shiftId: violation.shiftIds[0] ?? null, date: violation.date },
    });
  }

  return (
    <button
      onClick={highlight}
      className={`w-full text-left rounded p-2 border text-xs transition-colors hover:bg-opacity-80 ${
        violation.severity === 'error'
          ? 'bg-red-50 border-red-200 hover:bg-red-100'
          : 'bg-amber-50 border-amber-200 hover:bg-amber-100'
      }`}
    >
      <div className="flex items-start gap-2">
        <span
          className={`shrink-0 mt-0.5 w-2 h-2 rounded-full ${
            violation.severity === 'error' ? 'bg-red-500' : 'bg-amber-400'
          }`}
        />
        <div>
          <span className={`font-semibold ${violation.severity === 'error' ? 'text-red-700' : 'text-amber-700'}`}>
            {RULE_LABELS[violation.ruleId] ?? violation.ruleId}
          </span>
          <p className="text-slate-600 mt-0.5 leading-snug">{violation.message}</p>
        </div>
      </div>
    </button>
  );
}

import { useMemo } from 'react';
import { useAppState } from '../../store/AppContext';
import { ViolationCard } from './ViolationCard';
import { violationsBySurgeon } from '../../store/selectors';

export function ConflictPanel() {
  const { state } = useAppState();
  const { violations, surgeons } = state;

  const byGroup = useMemo(() => violationsBySurgeon(violations), [violations]);

  if (violations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-slate-400 text-sm">
        <span className="text-2xl mb-1">✓</span>
        No conflicts
      </div>
    );
  }

  const getSurgeonName = (id: string) =>
    surgeons.find(s => s.id === id)?.name ?? id;

  return (
    <div className="space-y-4 overflow-y-auto">
      {Array.from(byGroup.entries()).map(([surgeonId, viols]) => (
        <div key={surgeonId}>
          <p className="text-xs font-semibold text-slate-500 mb-1.5 truncate">
            {getSurgeonName(surgeonId)}
          </p>
          <div className="space-y-1.5">
            {viols.map(v => <ViolationCard key={v.id} violation={v} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

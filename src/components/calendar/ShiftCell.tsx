import { useDroppable } from '@dnd-kit/core';
import { v4 as uuidv4 } from 'uuid';
import type { Shift, ShiftKind, AncillaryKind } from '../../types/shift';
import type { SurgeonType, BlackoutDate, RobotBlock } from '../../types/surgeon';
import type { Violation } from '../../types/violation';
import { ShiftChip } from './ShiftChip';
import { useAppState } from '../../store/AppContext';

interface Props {
  surgeonId: string;
  surgeonType: SurgeonType;
  date: string;
  shifts: Shift[];
  violationMap: Map<string, Violation[]>;
  highlightedShiftId: string | null;
  highlightedDate: string | null;
  isHoliday?: boolean;
  isWeekend?: boolean;
  blackout?: BlackoutDate;
  robotBlock?: RobotBlock;
}

const POOL_KINDS: ShiftKind[] = ['OCN'];
const REGULAR_KINDS: ShiftKind[] = ['OCD', 'OCN', '24H'];

function ancillariesFor(kind: ShiftKind): AncillaryKind[] | undefined {
  if (kind === 'OCN') return ['PRECALL_AM', 'POSTCALL_PM'];
  if (kind === '24H') return ['POSTCALL_AM', 'POSTCALL_PM'];
  return undefined;
}

export function ShiftCell({
  surgeonId,
  surgeonType,
  date,
  shifts,
  violationMap,
  highlightedShiftId,
  highlightedDate,
  isHoliday,
  isWeekend,
  blackout,
  robotBlock,
}: Props) {
  const { dispatch } = useAppState();
  const { setNodeRef, isOver } = useDroppable({
    id: `${surgeonId}::${date}`,
    data: { surgeonId, date },
  });

  const isHighlightedDate = highlightedDate === date;
  const availableKinds = surgeonType === 'POOL' ? POOL_KINDS : REGULAR_KINDS;

  // Call shifts only (EGS spans multiple rows and isn't cycled)
  const callShifts = shifts.filter(s => s.kind !== 'EGS');
  const cycleable = callShifts.length <= 1;

  function handleCellClick() {
    if (!cycleable) return;

    if (callShifts.length === 0) {
      // Empty → first kind
      const kind = availableKinds[0];
      dispatch({
        type: 'ADD_SHIFT',
        payload: { id: uuidv4(), surgeonId, date, kind, endDate: undefined, ancillaries: ancillariesFor(kind) },
      });
      return;
    }

    const current = callShifts[0];
    const idx = availableKinds.indexOf(current.kind);
    dispatch({ type: 'DELETE_SHIFT', payload: { shiftId: current.id } });

    // Advance to next kind; at end of cycle → blank
    if (idx >= 0 && idx < availableKinds.length - 1) {
      const next = availableKinds[idx + 1];
      dispatch({
        type: 'ADD_SHIFT',
        payload: { id: uuidv4(), surgeonId, date, kind: next, endDate: undefined, ancillaries: ancillariesFor(next) },
      });
    }
  }

  return (
    <div
      ref={setNodeRef}
      onClick={handleCellClick}
      className={`
        relative min-h-[36px] p-1 border-r border-b border-slate-100
        flex flex-wrap gap-0.5 items-start content-start
        transition-colors group
        ${cycleable ? 'cursor-pointer hover:bg-blue-50/40' : ''}
        ${isOver ? 'bg-blue-50' : ''}
        ${isHoliday ? 'bg-amber-50' : ''}
        ${isWeekend && !isHoliday ? 'bg-slate-50' : ''}
        ${isHighlightedDate ? 'ring-1 ring-inset ring-blue-300' : ''}
      `}
    >
      {/* Blackout overlay */}
      {blackout && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(148,163,184,0.18) 3px, rgba(148,163,184,0.18) 4px)' }}
          title={
            blackout.type === 'OCD' ? 'Blackout: no OCD call'
            : blackout.type === 'OCN' ? 'Blackout: no OCN call'
            : 'Blackout: no call (OCD + OCN)'
          }
        />
      )}

      {shifts.length === 0 && !blackout && !robotBlock && (
        <span className="absolute inset-0 flex items-center justify-center text-slate-200 text-xs opacity-0 group-hover:opacity-100 select-none pointer-events-none">
          +
        </span>
      )}

      {shifts.map(shift => (
        <ShiftChip
          key={shift.id}
          shift={shift}
          violations={violationMap.get(shift.id) ?? []}
          isHighlighted={shift.id === highlightedShiftId}
        />
      ))}

      {/* Constraint badges — pinned to bottom of cell */}
      {(blackout || robotBlock) && (
        <div className="absolute bottom-0.5 left-0 right-0 flex flex-col gap-0.5 px-0.5 pointer-events-none">
          {blackout && (
            <span
              className="w-full text-center text-[8px] font-semibold leading-tight py-[1px] rounded-sm bg-slate-300/70 text-slate-600"
              title={
                blackout.type === 'OCD' ? 'Blackout: no OCD call'
                : blackout.type === 'OCN' ? 'Blackout: no OCN call'
                : 'Blackout: no call (OCD + OCN)'
              }
            >
              {blackout.type === 'OCD' ? 'no OCD' : blackout.type === 'OCN' ? 'no OCN' : 'blocked'}
            </span>
          )}
          {robotBlock && (
            <span
              className={`w-full text-center text-[8px] font-semibold leading-tight py-[1px] rounded-sm ${
                robotBlock.assistingOnly
                  ? 'bg-amber-100 text-amber-600'
                  : 'bg-amber-200 text-amber-700'
              }`}
              title={robotBlock.assistingOnly ? 'Robot block (assisting OK)' : 'Robot block (no call)'}
            >
              {robotBlock.assistingOnly ? 'robot/asst' : 'robot'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

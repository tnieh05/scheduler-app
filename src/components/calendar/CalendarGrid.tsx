import { useMemo } from 'react';
import { useAppState } from '../../store/AppContext';
import { ShiftCell } from './ShiftCell';
import { DndProvider } from './DndProvider';
import { shiftsByCellKey, violationsByShiftId } from '../../store/selectors';
import {
  dateRange, firstOfMonth, lastOfMonth, dayOfWeek, dayNumber,
  shortDayLabel,
} from '../../lib/dateUtils';
import { getHolidaysForRange } from '../../constants/holidays';

export function CalendarGrid() {
  const { state, dispatch } = useAppState();
  const { surgeons, schedule, violations, activeMonth, highlightedShiftId, highlightedDate, selectedSurgeonId } = state;

  const [year, month] = activeMonth.split('-').map(Number);
  const monthStart = firstOfMonth(year, month);
  const monthEnd = lastOfMonth(year, month);
  const dates = useMemo(() => dateRange(monthStart, monthEnd), [monthStart, monthEnd]);
  const holidays = useMemo(
    () => getHolidaysForRange(monthStart, monthEnd),
    [monthStart, monthEnd],
  );

  const cellMap = useMemo(
    () => shiftsByCellKey(schedule?.shifts ?? []),
    [schedule?.shifts],
  );
  const violMap = useMemo(
    () => violationsByShiftId(violations),
    [violations],
  );

  if (surgeons.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        Add surgeons and generate a schedule to view the calendar.
      </div>
    );
  }

  const dayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const nameColWidth = 140;
  const cellWidth = 38;

  return (
    <DndProvider>
      <div className="overflow-auto h-full">
        <table className="border-collapse" style={{ minWidth: nameColWidth + dates.length * cellWidth }}>
          <thead>
            <tr>
              {/* Sticky name column header */}
              <th
                className="sticky left-0 z-20 bg-white border-b border-r border-slate-200 text-left px-3 py-2 text-xs font-medium text-slate-500"
                style={{ width: nameColWidth, minWidth: nameColWidth }}
              >
                Surgeon
              </th>
              {dates.map(date => {
                const dow = dayOfWeek(date);
                const isWknd = dow === 5 || dow === 6 || dow === 0;
                const isHol = holidays.has(date);
                return (
                  <th
                    key={date}
                    className={`border-b border-r border-slate-100 text-center py-1 text-[10px] font-medium
                      ${isHol ? 'bg-amber-50 text-amber-600' : isWknd ? 'bg-slate-50 text-slate-500' : 'text-slate-600'}
                    `}
                    style={{ width: cellWidth, minWidth: cellWidth }}
                    title={isHol ? 'Holiday' : undefined}
                  >
                    <div>{dayNumber(date)}</div>
                    <div className="text-[9px] text-slate-400">{dayLabels[dow]}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {surgeons.map(surgeon => {
              const isSelected = selectedSurgeonId === surgeon.id;
              return (
              <tr key={surgeon.id} className="hover:bg-slate-50/50">
                {/* Sticky surgeon name — clickable to open context panel */}
                <td
                  className={`sticky left-0 z-10 border-b border-r border-slate-200 px-3 py-1 transition-colors ${
                    isSelected ? 'bg-blue-50' : 'bg-white'
                  }`}
                  style={{ width: nameColWidth, minWidth: nameColWidth }}
                >
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'SELECT_SURGEON', payload: surgeon.id })}
                    className="flex items-center gap-1.5 w-full text-left group"
                    title="Click to edit surgeon"
                  >
                    <span
                      className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                        surgeon.type === 'EGS'
                          ? 'bg-teal-100 text-teal-600'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {surgeon.type === 'EGS' ? 'EGS' : 'Non'}
                    </span>
                    <span
                      className={`text-xs truncate ${
                        isSelected ? 'text-blue-700 font-semibold' : 'text-slate-700 group-hover:text-blue-600'
                      }`}
                      title={surgeon.name}
                    >
                      {surgeon.name}
                    </span>
                  </button>
                </td>
                {dates.map(date => {
                  const key = `${surgeon.id}::${date}`;
                  const cellShifts = cellMap.get(key) ?? [];
                  const dow = dayOfWeek(date);
                  const blackout = surgeon.blackouts.find(b => b.date === date);
                  const robotBlock = surgeon.robotBlocks.find(r => r.date === date);
                  return (
                    <td key={date} className="p-0" style={{ width: cellWidth, minWidth: cellWidth }}>
                      <ShiftCell
                        surgeonId={surgeon.id}
                        surgeonType={surgeon.type}
                        date={date}
                        shifts={cellShifts}
                        violationMap={violMap}
                        highlightedShiftId={highlightedShiftId}
                        highlightedDate={highlightedDate}
                        isHoliday={holidays.has(date)}
                        isWeekend={dow === 5 || dow === 6 || dow === 0}
                        blackout={blackout}
                        robotBlock={robotBlock}
                      />
                    </td>
                  );
                })}
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
    </DndProvider>
  );
}

void shortDayLabel; // used indirectly via dayLabels array

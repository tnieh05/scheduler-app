import { useMemo, useRef, useState, useEffect } from 'react';
import { useAppState } from '../../store/AppContext';
import { computeAvailableDays } from '../../engine/generator';
import { isWeekend, isoMonth, isoYear, monthLabel, dateRange, firstOfMonth, lastOfMonth } from '../../lib/dateUtils';

const TYPE_LABEL: Record<string, string> = { EGS: 'EGS', NON_EGS: 'Non', POOL: 'Pool' };
const MIN_HEIGHT = 72;

function Cell({ value }: { value: number }) {
  return (
    <td className="text-center tabular-nums text-slate-600 py-1 px-2">
      {value === 0 ? <span className="text-slate-300">—</span> : value}
    </td>
  );
}

export function StatsPanel() {
  const { state } = useAppState();
  const { surgeons, schedule, activeMonth } = state;

  // null = auto-size to content; number = user has dragged to a fixed height
  const [height, setHeight] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startY: number; startHeight: number } | null>(null);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragState.current) return;
      const delta = dragState.current.startY - e.clientY;
      setHeight(Math.max(MIN_HEIGHT, dragState.current.startHeight + delta));
    }
    function onMouseUp() {
      if (dragState.current) dragState.current = null;
    }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  function handleDragStart(e: React.MouseEvent) {
    e.preventDefault();
    const currentHeight = containerRef.current?.getBoundingClientRect().height ?? 300;
    dragState.current = { startY: e.clientY, startHeight: currentHeight };
  }

  const [year, month] = activeMonth.split('-').map(Number);

  const rows = useMemo(() => {
    if (!schedule) return [];
    const monthStart = firstOfMonth(year, month);
    const monthEnd = lastOfMonth(year, month);
    const monthDates = dateRange(monthStart, monthEnd);

    return surgeons.map(surgeon => {
      const mine = schedule.shifts.filter(
        s => s.surgeonId === surgeon.id && isoYear(s.date) === year && isoMonth(s.date) === month,
      );
      const ocd = mine.filter(s => s.kind === 'OCD').length;
      const ocn = mine.filter(s => s.kind === 'OCN').length;
      const h24 = mine.filter(s => s.kind === '24H').length;
      const egs = mine.filter(s => s.kind === 'EGS').length;
      const weekend = mine.filter(
        s => (s.kind === 'OCD' || s.kind === 'OCN' || s.kind === '24H') && isWeekend(s.date),
      ).length;
      const avail = surgeon.type !== 'POOL'
        ? computeAvailableDays(surgeon, monthDates, schedule.shifts)
        : null;
      return { surgeon, ocd, ocn, h24, egs, total: ocd + ocn + h24 * 2, weekend, avail };
    });
  }, [schedule, surgeons, year, month]);

  if (!schedule) return null;

  // When auto-sizing, the outer div is a plain block so the table sizes to its
  // natural content height. When the user has dragged to a fixed height, switch
  // to a flex column so the inner div can fill the remaining space and scroll.
  const isFixed = height !== null;

  return (
    <div
      ref={containerRef}
      className={`bg-white shrink-0 ${isFixed ? 'flex flex-col' : ''}`}
      style={isFixed ? { height } : undefined}
    >
      {/* Drag handle */}
      <div
        onMouseDown={handleDragStart}
        className="h-2 shrink-0 cursor-ns-resize border-t border-slate-200 flex items-center justify-center group hover:border-blue-300 transition-colors"
        title="Drag to resize"
      >
        <div className="w-8 h-0.5 rounded-full bg-slate-300 group-hover:bg-blue-400 transition-colors" />
      </div>

      {/* Content — scrollable only when user has set a fixed height */}
      <div className={`overflow-x-auto ${isFixed ? 'flex-1 overflow-y-auto' : ''}`}>
        <div className="px-4 pt-1.5 pb-1 flex items-center gap-2 sticky top-0 bg-white z-10 border-b border-slate-100">
          <h2 className="text-xs font-semibold text-slate-600">Stats</h2>
          <span className="text-xs text-slate-400">{monthLabel(activeMonth + '-01')}</span>
        </div>

        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-[29px] bg-white z-10">
            <tr className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
              <th className="text-left px-4 py-1 font-semibold">Surgeon</th>
              <th className="text-center px-2 py-1 font-semibold">OCD</th>
              <th className="text-center px-2 py-1 font-semibold">OCN</th>
              <th className="text-center px-2 py-1 font-semibold">24H</th>
              <th className="text-center px-2 py-1 font-semibold">EGS</th>
              <th className="text-center px-2 py-1 font-semibold">Total calls</th>
              <th className="text-center px-2 py-1 font-semibold">Weekend calls</th>
              <th
                className="text-center px-2 py-1 font-semibold"
                title="Days in this month the surgeon is not blocked by blackouts, robot cases, or EGS duty"
              >
                Avail days
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ surgeon, ocd, ocn, h24, egs, total, weekend, avail }) => (
              <tr key={surgeon.id} className="hover:bg-slate-50">
                <td className="px-4 py-1 whitespace-nowrap">
                  <span className="text-slate-700 font-medium">{surgeon.name}</span>
                  <span className="ml-1.5 text-[10px] text-slate-400">{TYPE_LABEL[surgeon.type]}</span>
                </td>
                <Cell value={ocd} />
                <Cell value={ocn} />
                <Cell value={h24} />
                <Cell value={egs} />
                <td className="text-center tabular-nums font-semibold text-slate-700 py-1 px-2">
                  {total === 0 ? <span className="text-slate-300 font-normal">—</span> : total}
                </td>
                <Cell value={weekend} />
                <td className="text-center tabular-nums py-1 px-2 text-slate-400 text-[11px]">
                  {avail ?? <span className="text-slate-200">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

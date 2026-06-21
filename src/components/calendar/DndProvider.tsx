import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Shift } from '../../types/shift';
import { useAppState } from '../../store/AppContext';

const KIND_STYLES: Record<string, string> = {
  OCD: 'bg-blue-100 text-blue-800 border-blue-200',
  OCN: 'bg-purple-100 text-purple-800 border-purple-200',
  EGS: 'bg-teal-100 text-teal-800 border-teal-200',
  '24H': 'bg-gradient-to-r from-blue-100 to-purple-100 text-indigo-800 border-indigo-200',
};

interface ContextMenuState {
  shift: Shift;
  x: number;
  y: number;
}

type OpenMenuFn = (shift: Shift, x: number, y: number) => void;

const ShiftContextMenuContext = createContext<OpenMenuFn>(() => {});
export const useShiftContextMenu = () => useContext(ShiftContextMenuContext);

interface Props {
  children: ReactNode;
}

export function DndProvider({ children }: Props) {
  const { state, dispatch } = useAppState();
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  // Dismiss on click-outside or Escape
  useEffect(() => {
    if (!contextMenu) return;
    function handleMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setContextMenu(null);
    }
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  function openMenu(shift: Shift, x: number, y: number) {
    setContextMenu({ shift, x, y });
  }

  function onDragStart(event: DragStartEvent) {
    const shift = event.active.data.current?.shift as Shift | undefined;
    if (shift) setActiveShift(shift);
    setContextMenu(null);
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveShift(null);
    const { active, over } = event;
    if (!over || !state.schedule) return;

    const draggedShift = active.data.current?.shift as Shift | undefined;
    if (!draggedShift) return;

    const [targetSurgeonId, targetDate] = (over.id as string).split('::');
    if (!targetSurgeonId || !targetDate) return;

    if (draggedShift.surgeonId === targetSurgeonId && draggedShift.date === targetDate) return;

    const targetShifts = state.schedule.shifts.filter(
      s => s.surgeonId === targetSurgeonId && s.date === targetDate,
    );

    if (targetShifts.length > 0 && targetShifts[0].kind === draggedShift.kind) {
      dispatch({ type: 'SWAP_SHIFTS', payload: { shiftIdA: draggedShift.id, shiftIdB: targetShifts[0].id } });
    } else {
      dispatch({ type: 'MOVE_SHIFT', payload: { shiftId: draggedShift.id, newSurgeonId: targetSurgeonId, newDate: targetDate } });
    }
  }

  const isPinned = contextMenu?.shift.pinned ?? false;

  return (
    <ShiftContextMenuContext.Provider value={openMenu}>
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        {children}
        <DragOverlay>
          {activeShift && (
            <div
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border opacity-80 shadow-md cursor-grabbing
                ${KIND_STYLES[activeShift.kind] ?? 'bg-slate-100 text-slate-700 border-slate-200'}`}
            >
              {activeShift.kind}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {contextMenu && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 9999 }}
          className="bg-white border border-slate-200 rounded-md shadow-lg py-1 min-w-[130px] text-sm"
          onMouseDown={e => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-2"
            onClick={() => {
              dispatch({ type: 'TOGGLE_PIN_SHIFT', payload: { shiftId: contextMenu.shift.id } });
              setContextMenu(null);
            }}
          >
            <span className="text-amber-500">{isPinned ? '✕' : '📌'}</span>
            {isPinned ? 'Unpin shift' : 'Pin shift'}
          </button>
        </div>
      )}
    </ShiftContextMenuContext.Provider>
  );
}

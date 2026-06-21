import { useDraggable } from '@dnd-kit/core';
import type { Shift } from '../../types/shift';
import type { Violation } from '../../types/violation';
import { useShiftContextMenu } from './DndProvider';

const KIND_STYLES: Record<string, string> = {
  OCD: 'bg-blue-100 text-blue-800 border-blue-200',
  OCN: 'bg-purple-100 text-purple-800 border-purple-200',
  EGS: 'bg-teal-100 text-teal-800 border-teal-200',
  '24H': 'bg-gradient-to-r from-blue-100 to-purple-100 text-indigo-800 border-indigo-200',
};

interface Props {
  shift: Shift;
  violations: Violation[];
  isHighlighted?: boolean;
}

export function ShiftChip({ shift, violations, isHighlighted }: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: shift.id,
    data: { shift },
  });

  const openMenu = useShiftContextMenu();

  const hasError = violations.some(v => v.severity === 'error');
  const hasWarning = !hasError && violations.some(v => v.severity === 'warning');
  const isPinnable = shift.kind !== 'EGS';

  function handleContextMenu(e: React.MouseEvent) {
    if (!isPinnable) return;
    e.preventDefault();
    e.stopPropagation();
    openMenu(shift, e.clientX, e.clientY);
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onContextMenu={handleContextMenu}
      className={`
        relative select-none cursor-grab active:cursor-grabbing
        text-[10px] font-semibold px-1.5 py-0.5 rounded border
        transition-opacity whitespace-nowrap
        ${KIND_STYLES[shift.kind] ?? 'bg-slate-100 text-slate-700 border-slate-200'}
        ${isDragging ? 'opacity-30' : ''}
        ${hasError ? '!border-red-400 !bg-red-50 !text-red-700' : ''}
        ${hasWarning ? '!border-amber-400' : ''}
        ${isHighlighted ? 'ring-2 ring-offset-1 ring-blue-400' : ''}
        ${shift.pinned ? 'ring-1 ring-offset-1 ring-amber-400' : ''}
      `}
      title={violations.map(v => v.message).join('\n') || shift.kind}
    >
      {shift.kind}
      {shift.pinned && (
        <span className="absolute -top-1.5 -right-1.5 text-[8px] leading-none select-none pointer-events-none">
          📌
        </span>
      )}
      {(hasError || hasWarning) && (
        <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${hasError ? 'bg-red-500' : 'bg-amber-400'}`} />
      )}
    </div>
  );
}

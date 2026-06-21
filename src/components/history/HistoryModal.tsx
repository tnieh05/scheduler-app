import { useState } from 'react';
import { useAppState } from '../../store/AppContext';
import { useSavedSchedules } from '../../hooks/useSavedSchedules';
import type { SavedSchedule } from '../../types/savedSchedule';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function formatRange(start: string, end: string) {
  const fmt = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

function ScheduleRow({
  entry,
  onLoad,
  onDelete,
  onRename,
}: {
  entry: SavedSchedule;
  onLoad: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.name);

  function commitRename() {
    if (draft.trim()) onRename(draft.trim());
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-slate-50 group">
      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') { setDraft(entry.name); setEditing(false); }
            }}
            className="w-full border border-blue-300 rounded px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-sm font-medium text-slate-700 hover:text-blue-600 text-left truncate w-full transition-colors"
            title="Click to rename"
          >
            {entry.name}
          </button>
        )}
        <p className="text-[11px] text-slate-400 mt-0.5 truncate">
          {formatRange(entry.schedule.range.start, entry.schedule.range.end)}
          <span className="mx-1.5">·</span>
          {formatDate(entry.savedAt)}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onLoad}
          className="text-xs px-2.5 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 font-medium transition-colors"
        >
          Load
        </button>
        <button
          onClick={onDelete}
          className="text-xs px-2 py-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Delete"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export function HistoryModal({ onClose }: { onClose: () => void }) {
  const { dispatch } = useAppState();
  const { saves, remove, rename } = useSavedSchedules();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function handleLoad(entry: SavedSchedule) {
    dispatch({ type: 'LOAD_SAVED_SCHEDULE', payload: entry });
    onClose();
  }

  function handleDelete(id: string) {
    if (confirmDelete === id) {
      remove(id);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(id);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/30"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col pointer-events-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Saved Schedules</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-lg leading-none transition-colors"
            >
              ✕
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {saves.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                <p className="text-sm">No saved schedules yet.</p>
                <p className="text-xs">Generate a schedule and click Save to store it here.</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {saves.map(entry => (
                  <div key={entry.id}>
                    <ScheduleRow
                      entry={entry}
                      onLoad={() => handleLoad(entry)}
                      onDelete={() => handleDelete(entry.id)}
                      onRename={name => rename(entry.id, name)}
                    />
                    {confirmDelete === entry.id && (
                      <div className="mx-3 mb-1 flex items-center gap-2 bg-red-50 border border-red-200 rounded px-3 py-1.5 text-xs text-red-700">
                        <span className="flex-1">Delete "{entry.name}"?</span>
                        <button
                          onClick={() => remove(entry.id)}
                          className="font-medium hover:underline"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="text-slate-500 hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {saves.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-100">
              <p className="text-[11px] text-slate-400">
                Click a name to rename · Hover to see Load / Delete
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppState } from '../../store/AppContext';
import { ManualEntryForm } from './ManualEntryForm';
import type { Surgeon } from '../../types';

function DeleteModal({
  surgeon,
  onConfirm,
  onCancel,
}: {
  surgeon: Surgeon;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-xl w-80 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-800">Remove {surgeon.name}?</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          This will permanently remove the surgeon and all of their assigned shifts from the schedule.
          This cannot be undone.
        </p>
        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 py-1.5 text-xs rounded border border-slate-200 text-slate-500 hover:border-slate-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-1.5 text-xs font-medium rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
          >
            Remove surgeon
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function UploadPanel() {
  const { state, dispatch } = useAppState();
  const { selectedSurgeonId, surgeons } = state;
  const [confirmDelete, setConfirmDelete] = useState(false);

  const selectedSurgeon = selectedSurgeonId
    ? surgeons.find(s => s.id === selectedSurgeonId) ?? null
    : null;

  function handleDeselect() {
    dispatch({ type: 'SELECT_SURGEON', payload: null });
  }

  function handleDelete() {
    if (!selectedSurgeon) return;
    dispatch({ type: 'REMOVE_SURGEON', payload: { id: selectedSurgeon.id } });
    setConfirmDelete(false);
  }

  // Selected surgeon: show their edit form with a delete option.
  if (selectedSurgeon) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                selectedSurgeon.type === 'EGS'
                  ? 'bg-teal-100 text-teal-600'
                  : selectedSurgeon.type === 'POOL'
                  ? 'bg-purple-100 text-purple-600'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {selectedSurgeon.type === 'EGS' ? 'EGS' : selectedSurgeon.type === 'POOL' ? 'Pool' : 'Non'}
            </span>
            <span className="text-sm font-semibold text-slate-800">{selectedSurgeon.name}</span>
          </div>
          <button
            onClick={handleDeselect}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            title="Close"
          >
            ✕
          </button>
        </div>

        <ManualEntryForm
          key={selectedSurgeon.id}
          initialSurgeon={selectedSurgeon}
          onSaved={handleDeselect}
        />

        <div className="border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="w-full py-1.5 text-xs font-medium rounded border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 transition-colors"
          >
            Remove surgeon
          </button>
        </div>

        {confirmDelete && (
          <DeleteModal
            surgeon={selectedSurgeon}
            onConfirm={handleDelete}
            onCancel={() => setConfirmDelete(false)}
          />
        )}
      </div>
    );
  }

  // Default: add a new surgeon.
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xs font-semibold text-slate-600 mb-1">Add Surgeon</h2>
        <p className="text-xs text-slate-400">
          Click a surgeon's name in the calendar to view and edit their profile.
        </p>
      </div>
      <ManualEntryForm key="new" />
    </div>
  );
}

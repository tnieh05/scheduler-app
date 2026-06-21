import { useState } from 'react';
import { createPortal } from 'react-dom';
import { HtmlImporter } from '../upload/HtmlImporter';

function ImportModal({ onClose }: { onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-[480px] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <h2 className="text-sm font-semibold text-slate-800">Import Schedule</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors text-lg leading-none"
            title="Close"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <HtmlImporter onDone={onClose} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function ImportButton({ className }: { className?: string } = {}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`text-slate-500 hover:text-slate-700 text-sm font-medium px-3 py-1.5 rounded border border-slate-200 hover:border-slate-300 transition-colors ${className ?? ''}`}
      >
        Import
      </button>
      {open && <ImportModal onClose={() => setOpen(false)} />}
    </>
  );
}

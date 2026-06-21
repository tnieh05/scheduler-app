import { useRef, useState, type DragEvent } from 'react';
import { parseCSV } from '../../lib/csvParser';
import { useAppState } from '../../store/AppContext';

export function CSVUploader() {
  const { dispatch } = useAppState();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleFile(file: File) {
    if (!file.name.endsWith('.csv')) {
      dispatch({ type: 'SET_PARSE_ERRORS', payload: ['File must be a .csv'] });
      return;
    }
    setLoading(true);
    const result = await parseCSV(file);
    setLoading(false);
    if (result.errors.length > 0) {
      dispatch({ type: 'SET_PARSE_ERRORS', payload: result.errors });
    }
    if (result.surgeons.length > 0) {
      dispatch({ type: 'ADD_SURGEONS', payload: result.surgeons });
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className="space-y-3">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          dragging
            ? 'border-blue-400 bg-blue-50'
            : 'border-slate-300 hover:border-blue-300 hover:bg-slate-50'
        }`}
      >
        <div className="text-slate-400 text-sm">
          {loading ? (
            <span>Parsing...</span>
          ) : (
            <>
              <p className="font-medium text-slate-600">Drop CSV here</p>
              <p className="text-xs mt-1">or click to browse</p>
            </>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
      <div className="text-xs text-slate-400 leading-relaxed space-y-1.5">
        <p className="font-medium text-slate-500">Expected columns:</p>
        <code className="block bg-slate-100 rounded p-2 text-slate-600 text-[11px]">
          name, type, ocd_blackouts, ocn_blackouts, both_blackouts, robot_blocks
        </code>
        <p><span className="font-medium text-slate-500">type:</span> EGS · NON_EGS · POOL</p>
        <p><span className="font-medium text-slate-500">dates:</span> YYYY-MM-DD, pipe-separated (e.g. 2026-07-04|2026-07-05)</p>
        <p><span className="font-medium text-slate-500">robot_blocks:</span> DATE:assistingOnly (e.g. 2026-07-10:false|2026-07-20:true)</p>
        <div className="bg-amber-50 border border-amber-200 rounded p-2 text-amber-700 mt-1">
          <p className="font-medium mb-0.5">ATO & NO CALL days</p>
          <p>Enter these under <code className="bg-amber-100 px-1 rounded">both_blackouts</code> — they block all on-call shifts for that day.</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-yellow-700">
          <p className="font-medium mb-0.5">Pool Surgeon</p>
          <p>Use type <code className="bg-yellow-100 px-1 rounded">POOL</code>. Available dates become OCN shifts — the scheduler does not auto-assign them. Max 6 OCN per month.</p>
        </div>
      </div>
    </div>
  );
}

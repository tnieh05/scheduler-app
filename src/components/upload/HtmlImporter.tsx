import { useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { parseHtmlSchedule, parseCsvConstraints, parseKpBlockScheduleCsv } from '../../lib/htmlScheduleParser';
import type { HtmlParseResult, ParsedSurgeon } from '../../lib/htmlScheduleParser';
import { useAppState } from '../../store/AppContext';
import type { Surgeon } from '../../types';
import type { Shift } from '../../types/shift';
import { weekMonday } from '../../lib/dateUtils';

function matchSurgeon(surgeons: Surgeon[], name: string): Surgeon | undefined {
  return surgeons.find(s => s.name.trim().toLowerCase() === name.trim().toLowerCase());
}

function egsShiftsFromDates(dates: string[], surgeonId: string): Shift[] {
  return [...new Set(dates)].sort().map(date => ({
    id: uuidv4(),
    surgeonId,
    date,
    kind: 'EGS' as const,
    endDate: undefined,
    ancillaries: undefined,
  }));
}

interface PreviewState {
  result: HtmlParseResult;
  filename: string;
  rawContent: string;
  isKpCsv: boolean;
}

export function HtmlImporter({ onDone }: { onDone?: () => void } = {}) {
  const { state, dispatch } = useAppState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPreview(null);

    const reader = new FileReader();
    reader.onload = evt => {
      const content = evt.target?.result as string;
      try {
        const isHtml = file.name.toLowerCase().endsWith('.html') || file.name.toLowerCase().endsWith('.htm');
        // Detect KP block schedule CSV by presence of "Kaiser Permanente" header
        const isKpBlock = !isHtml && content.includes('Kaiser Permanente');
        const result = isHtml
          ? parseHtmlSchedule(content)
          : isKpBlock
            ? parseKpBlockScheduleCsv(content)
            : parseCsvConstraints(content);
        if (result.surgeons.length === 0) {
          setError('No surgeon constraints found in this file. Make sure it\'s a Kaiser block schedule HTML/CSV or a constraints CSV.');
          return;
        }
        setPreview({ result, filename: file.name, rawContent: content, isKpCsv: isKpBlock });
      } catch {
        setError('Failed to parse the file. Check that it\'s a valid Kaiser HTML schedule or constraints CSV.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleApply() {
    if (!preview) return;
    const { result } = preview;
    const { dateRange } = result;

    let applied = 0;
    for (const ps of result.surgeons) {
      const surgeon = matchSurgeon(state.surgeons, ps.name);
      if (!surgeon) continue;

      // Keep constraints outside this schedule's date range; replace those within it.
      const keptRobot = dateRange
        ? surgeon.robotBlocks.filter(rb => rb.date < dateRange.start || rb.date > dateRange.end)
        : surgeon.robotBlocks;
      const keptBlackout = dateRange
        ? surgeon.blackouts.filter(b => b.date < dateRange.start || b.date > dateRange.end)
        : surgeon.blackouts;

      const updated: Surgeon = {
        ...surgeon,
        robotBlocks: [...keptRobot, ...ps.robotBlocks].sort((a, b) => a.date.localeCompare(b.date)),
        blackouts: [...keptBlackout, ...ps.blackouts].sort((a, b) => a.date.localeCompare(b.date)),
      };
      dispatch({ type: 'UPDATE_SURGEON', payload: updated });

      if (ps.egsShifts.length > 0) {
        dispatch({
          type: 'REPLACE_EGS_SHIFTS',
          payload: {
            surgeonId: surgeon.id,
            rangeStart: dateRange?.start ?? ps.egsShifts[0],
            rangeEnd: dateRange?.end ?? ps.egsShifts[ps.egsShifts.length - 1],
            egsShifts: egsShiftsFromDates(ps.egsShifts, surgeon.id),
          },
        });
      }

      applied++;
    }

    if (applied === 0) {
      setError('No surgeons matched. Add surgeons to the roster first, then import.');
      return;
    }

    // Expand the cumulative imported range to include this file's dates
    if (dateRange) {
      dispatch({ type: 'MERGE_IMPORTED_RANGE', payload: dateRange });
    }

    // Store raw KP CSV so Export CSV can reproduce the original format
    if (preview.isKpCsv) {
      dispatch({ type: 'SET_RAW_SCHEDULE_FILE', payload: preview.rawContent });
    }

    setPreview(null);
    onDone?.();
  }

  const hasAnyMatch = (surgeons: ParsedSurgeon[]) =>
    surgeons.some(ps => matchSurgeon(state.surgeons, ps.name));

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Import EGS shifts, robot blocks, and blackout dates from a Kaiser block schedule
        HTML export or CSV.
      </p>

      <div className="text-[10px] text-slate-400 bg-slate-50 rounded p-2 space-y-0.5">
        <p className="font-medium text-slate-500">CSV format:</p>
        <p className="font-mono">name,date,constraint</p>
        <p className="font-mono">Chen,2026-07-03,AMC ROBOT</p>
        <p className="font-mono">Chen,2026-07-08,ATO</p>
        <p className="text-slate-400 mt-1">
          Constraint values: AMC ROBOT · AMC ROBOT ASSIST · DUB ROBOT · WCR OR · AD AM/PM · NO CALL · NO DAY CALL · ATO · VAC · OFF PM
        </p>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".html,.htm,.csv"
        className="hidden"
        onChange={handleFile}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="w-full py-1.5 text-xs font-medium rounded border border-dashed border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
      >
        Choose schedule file (.html, .csv)…
      </button>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {preview && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 truncate">
            {preview.filename}
            {preview.result.dateRange && (
              <span className="ml-1 text-slate-400">
                · {preview.result.dateRange.start} → {preview.result.dateRange.end}
              </span>
            )}
          </p>

          <div className="space-y-1 max-h-48 overflow-y-auto">
            {preview.result.surgeons.map(ps => {
              const matched = matchSurgeon(state.surgeons, ps.name);
              const egsMondays = [...new Set(ps.egsShifts.map(weekMonday))].sort();
              return (
                <div
                  key={ps.name}
                  className={`text-xs rounded px-2 py-1 space-y-0.5 ${
                    matched ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{ps.name}</span>
                    <span className="text-[10px] shrink-0 opacity-75">
                      {[
                        ps.robotBlocks.length > 0 && `${ps.robotBlocks.length} robot`,
                        ps.blackouts.length > 0 && `${ps.blackouts.length} blackout`,
                        !matched && 'no roster match',
                      ].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  {egsMondays.length > 0 && (
                    <div className="text-[10px] opacity-60">
                      EGS weeks: {egsMondays.map(m => {
                        const d = new Date(m + 'T12:00:00');
                        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      }).join(', ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {!hasAnyMatch(preview.result.surgeons) && (
            <p className="text-xs text-amber-600">
              None of these surgeons are in the roster — populate the roster first.
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="flex-1 py-1.5 text-xs rounded border border-slate-200 text-slate-500 hover:border-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!hasAnyMatch(preview.result.surgeons)}
              className="flex-1 py-1.5 text-xs font-medium rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 transition-colors"
            >
              Import schedule
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

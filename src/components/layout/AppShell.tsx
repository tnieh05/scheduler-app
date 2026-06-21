import { useState } from 'react';
import { Header } from './Header';
import { ScheduleToolbar } from './ScheduleToolbar';
import { UploadPanel } from '../upload/UploadPanel';
import { CalendarGrid } from '../calendar/CalendarGrid';
import { ConflictPanel } from '../conflicts/ConflictPanel';
import { StatsPanel } from '../stats/StatsPanel';
import { useAppState } from '../../store/AppContext';
import { errorCount, warningCount } from '../../store/selectors';

export function AppShell() {
  const { state } = useAppState();
  const errors = errorCount(state.violations);
  const warnings = warningCount(state.violations);
  const totalViolations = errors + warnings;
  const [conflictsOpen, setConflictsOpen] = useState(true);

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Row 1: title + document actions (full width) */}
      <Header />

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-72 shrink-0 border-r border-slate-200 bg-white overflow-y-auto p-4">
          <UploadPanel />
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {/* Row 2: schedule controls (spans only this column) */}
          <ScheduleToolbar />

          {state.schedule && state.surgeons.length > 0 ? (
            <>
              <div className="flex-1 min-h-0 overflow-hidden">
                <CalendarGrid />
              </div>
              <StatsPanel />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-slate-400 gap-2">
              <p className="text-sm">Load surgeons from the sidebar to get started.</p>
            </div>
          )}
        </main>

        {/* Right panel — collapsible */}
        <aside
          className={`shrink-0 border-l border-slate-200 bg-white flex flex-col transition-all duration-200 ${
            conflictsOpen ? 'w-72' : 'w-10'
          }`}
        >
          <div className="flex items-center justify-between px-3 py-3 border-b border-slate-100">
            {conflictsOpen && (
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-sm font-semibold text-slate-700">Conflicts</h2>
                {totalViolations > 0 && (
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                      errors > 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {errors > 0
                      ? `${errors} error${errors > 1 ? 's' : ''}`
                      : `${warnings} warning${warnings > 1 ? 's' : ''}`}
                  </span>
                )}
              </div>
            )}
            <button
              onClick={() => setConflictsOpen(o => !o)}
              className="ml-auto text-slate-400 hover:text-slate-600 transition-colors shrink-0"
              title={conflictsOpen ? 'Collapse conflicts' : 'Expand conflicts'}
            >
              {conflictsOpen ? '›' : '‹'}
            </button>
          </div>

          {conflictsOpen && (
            <div className="flex-1 overflow-y-auto p-4">
              <ConflictPanel />
            </div>
          )}

          {!conflictsOpen && totalViolations > 0 && (
            <div className="flex-1 flex items-center justify-center">
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  errors > 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {totalViolations}
              </span>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

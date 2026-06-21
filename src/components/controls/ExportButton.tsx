import { useAppState } from '../../store/AppContext';
import { buildKpExportCsv } from '../../lib/exportKpCsv';

export function ExportButton({ className }: { className?: string } = {}) {
  const { state } = useAppState();
  const { schedule, surgeons, rawScheduleFile } = state;

  function handleExport() {
    if (!schedule) return;

    let csv: string;
    let filename: string;

    if (rawScheduleFile) {
      // Reproduce the original KP block schedule format with calls injected
      csv = buildKpExportCsv(rawScheduleFile, schedule, surgeons);
      filename = `schedule-${schedule.range.start}-${schedule.range.end}.csv`;
    } else {
      // Fallback: generic shift list
      const surgeonMap = new Map(surgeons.map(s => [s.id, s.name]));
      const rows = [
        ['Surgeon', 'Date', 'Kind', 'End Date', 'Ancillaries'],
        ...schedule.shifts.map(s => [
          surgeonMap.get(s.surgeonId) ?? s.surgeonId,
          s.date,
          s.kind,
          s.endDate ?? '',
          s.ancillaries?.join('|') ?? '',
        ]),
      ];
      csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
      filename = `schedule-${schedule.range.start}-${schedule.range.end}.csv`;
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleExport}
      disabled={!schedule}
      className={`border border-slate-300 hover:border-slate-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 text-sm px-3 py-1.5 rounded transition-colors ${className ?? ''}`}
    >
      Export CSV
    </button>
  );
}

import type { Schedule } from '../types/schedule';
import type { Surgeon } from '../types/surgeon';
import { buildKpExportCsv } from './exportKpCsv';

// Builds the schedule CSV (KP block format when the original import file is
// available, generic shift list otherwise) and triggers a browser download.
export function downloadScheduleCsv(
  schedule: Schedule,
  surgeons: Surgeon[],
  rawScheduleFile: string | null,
): void {
  let csv: string;

  if (rawScheduleFile) {
    // Reproduce the original KP block schedule format with calls injected
    csv = buildKpExportCsv(rawScheduleFile, schedule, surgeons);
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
  }

  const filename = `schedule-${schedule.range.start}-${schedule.range.end}.csv`;
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

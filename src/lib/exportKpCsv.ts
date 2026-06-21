import Papa from 'papaparse';
import type { Schedule } from '../types/schedule';
import type { Surgeon } from '../types/surgeon';

const MONTH_MAP: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function parseToken(token: string, year: number): string | null {
  const m = token.trim().match(/^([A-Za-z]{3})\s+(\d{1,2})$/);
  if (!m) return null;
  const month = MONTH_MAP[m[1]];
  if (!month) return null;
  return `${year}-${pad(month)}-${pad(parseInt(m[2], 10))}`;
}

function parseDateCell(text: string, year: number): string[] {
  const rangeMatch = text.trim().match(/^([A-Za-z]+ \d+)\s*-\s*([A-Za-z]+ \d+)$/);
  if (rangeMatch) {
    return [parseToken(rangeMatch[1], year), parseToken(rangeMatch[2], year)].filter(
      (d): d is string => d !== null,
    );
  }
  const single = parseToken(text.trim(), year);
  return single ? [single] : [];
}

function normalizeName(raw: string): string {
  const before = raw.split('(')[0].trim();
  return before
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function padRow(row: string[], n: number): string[] {
  const r = [...row];
  while (r.length < n) r.push('');
  return r;
}

/**
 * Injects on-call assignments (OCD/OCN/24H) from the generated schedule into
 * the original KP block schedule CSV as the first entry in each surgeon × date
 * cell, pushing existing activities down by one row.
 */
export function buildKpExportCsv(
  rawCsv: string,
  schedule: Schedule,
  surgeons: Surgeon[],
): string {
  const { data: rawData } = Papa.parse<string[]>(rawCsv, { header: false, skipEmptyLines: false });
  if (rawData.length === 0) return rawCsv;

  // Find year and date-header row
  let year = new Date().getFullYear();
  let headerRowIdx = -1;
  for (let i = 0; i < rawData.length; i++) {
    const yearMatch = rawData[i].join(' ').match(/(\d{4})/);
    if (yearMatch && headerRowIdx === -1) year = parseInt(yearMatch[1], 10);
    const dateCells = rawData[i].filter(c => /^[A-Za-z]{3}\s+\d{1,2}/.test(c.trim()));
    if (dateCells.length >= 2) { headerRowIdx = i; break; }
  }
  if (headerRowIdx === -1) return rawCsv;

  const headerRow = rawData[headerRowIdx];
  const numCols = headerRow.length;

  // col index → ISO dates it covers
  const datesByCol = new Map<number, string[]>();
  for (let col = 1; col < numCols; col++) {
    const dates = parseDateCell(headerRow[col]?.trim() ?? '', year);
    if (dates.length > 0) datesByCol.set(col, dates);
  }

  // surgeon name (lower) → date → call kind
  const callsByName = new Map<string, Map<string, string>>();
  for (const shift of schedule.shifts) {
    if (shift.kind !== 'OCD' && shift.kind !== 'OCN' && shift.kind !== '24H') continue;
    const surgeon = surgeons.find(s => s.id === shift.surgeonId);
    if (!surgeon) continue;
    const key = surgeon.name.trim().toLowerCase();
    if (!callsByName.has(key)) callsByName.set(key, new Map());
    callsByName.get(key)!.set(shift.date, shift.kind);
  }

  const output: string[][] = [];

  // Copy everything up to and including the header row unchanged
  for (let i = 0; i <= headerRowIdx; i++) {
    output.push(padRow(rawData[i], numCols));
  }

  let i = headerRowIdx + 1;
  while (i < rawData.length) {
    const row = rawData[i];
    const firstCell = (row[0] ?? '').trim();

    if (!firstCell || !/\(.+\)/.test(firstCell)) {
      // Non-surgeon row (separator, etc.) — copy as-is
      output.push(padRow(row, numCols));
      i++;
      continue;
    }

    // Surgeon block: collect all sub-rows until next surgeon header
    const blockRows: string[][] = [];
    let j = i;
    while (j < rawData.length) {
      const r = rawData[j];
      const fc = (r[0] ?? '').trim();
      if (j > i && fc && /\(.+\)/.test(fc)) break;
      blockRows.push(padRow(r, numCols));
      j++;
    }

    const surgeonName = normalizeName(firstCell);
    const surgeonCalls = callsByName.get(surgeonName.toLowerCase());

    if (!surgeonCalls || surgeonCalls.size === 0) {
      // No calls — copy block unchanged
      for (const r of blockRows) output.push(r);
      i = j;
      continue;
    }

    // Build per-column ordered activity lists from existing block rows
    const colActivities = new Map<number, string[]>();
    for (const subRow of blockRows) {
      for (let col = 1; col < numCols; col++) {
        const val = (subRow[col] ?? '').trim();
        if (val) {
          if (!colActivities.has(col)) colActivities.set(col, []);
          colActivities.get(col)!.push(val);
        }
      }
    }

    // Prepend call to each date column that has a call for this surgeon
    let hasInjection = false;
    for (const [col, dates] of datesByCol) {
      const callKind = dates.map(d => surgeonCalls.get(d)).find(Boolean);
      if (callKind) {
        const existing = colActivities.get(col) ?? [];
        colActivities.set(col, [callKind, ...existing]);
        hasInjection = true;
      }
    }

    if (!hasInjection) {
      for (const r of blockRows) output.push(r);
      i = j;
      continue;
    }

    // Reconstruct rows: row 0 gets the surgeon name; all rows get column activities
    const maxContentRows = Math.max(...[...colActivities.values()].map(a => a.length), 1);
    // Preserve at least as many rows as the original block to keep spacing
    const totalRows = Math.max(maxContentRows, blockRows.length);

    for (let rowIdx = 0; rowIdx < totalRows; rowIdx++) {
      const newRow: string[] = Array(numCols).fill('');
      if (rowIdx === 0) newRow[0] = firstCell;
      for (let col = 1; col < numCols; col++) {
        const activities = colActivities.get(col) ?? [];
        newRow[col] = activities[rowIdx] ?? '';
      }
      output.push(newRow);
    }

    i = j;
  }

  return Papa.unparse(output);
}

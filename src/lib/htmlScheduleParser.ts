import Papa from 'papaparse';
import type { BlackoutDate, RobotBlock } from '../types/surgeon';

export interface ParsedSurgeon {
  name: string;
  robotBlocks: RobotBlock[];
  blackouts: BlackoutDate[];
  egsShifts: string[]; // ISO dates on which this surgeon has EGS duty
}

export interface HtmlParseResult {
  surgeons: ParsedSurgeon[];
  /** ISO date range covered by this schedule file */
  dateRange: { start: string; end: string } | null;
}

// ─── Shared classification ────────────────────────────────────────────────────

function classifyConstraint(
  text: string,
):
  | { kind: 'robot'; assistingOnly: boolean }
  | { kind: 'blackout'; type: 'OCD' | 'BOTH' }
  | { kind: 'egs' }
  | null {
  const t = text.trim();

  // Robot blocks — no call the day before and day of
  if (t === 'AMC ROBOT') return { kind: 'robot', assistingOnly: false };
  if (t === 'AMC ROBOT ASSIST') return { kind: 'robot', assistingOnly: true };
  if (t === 'DUB ROBOT') return { kind: 'robot', assistingOnly: false };

  // EGS duty entries (DRV/AMC/WCR EGS …) — check before WCR OR to avoid conflicts
  if (/^(?:DRV|AMC|WCR)\s+EGS\b/i.test(t)) return { kind: 'egs' };

  // WCR OR (any variant, e.g. "WCR OR - Breast") → full no-call day
  if (t.startsWith('WCR OR')) return { kind: 'blackout', type: 'BOTH' };

  // Admin time → blocks day call (OCD); OCN may still be scheduled
  if (/^AD\b/.test(t)) return { kind: 'blackout', type: 'OCD' };

  if (t === 'NO DAY CALL' || t === 'OFF PM') return { kind: 'blackout', type: 'OCD' };
  if (t === 'NO CALL' || t === 'ATO' || t === 'VAC') return { kind: 'blackout', type: 'BOTH' };
  return null;
}

// ─── HTML parser ──────────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

function pad(n: number): string {
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
  // "Jun 06 - Jun 07" → two dates;  "Jun 01" → one date
  const rangeMatch = text.trim().match(/^([A-Za-z]+ \d+)\s*-\s*([A-Za-z]+ \d+)$/);
  if (rangeMatch) {
    return [parseToken(rangeMatch[1], year), parseToken(rangeMatch[2], year)].filter(
      (d): d is string => d !== null,
    );
  }
  const single = parseToken(text.trim(), year);
  return single ? [single] : [];
}

/**
 * Flattens an HTML table's rowspan/colspan structure into a 2-D grid where
 * each [row][col] holds the Element that visually occupies that cell.
 */
function buildGrid(rows: HTMLCollectionOf<HTMLTableRowElement>): (Element | undefined)[][] {
  const grid: (Element | undefined)[][] = [];
  for (let r = 0; r < rows.length; r++) {
    if (!grid[r]) grid[r] = [];
    let col = 0;
    for (let c = 0; c < rows[r].cells.length; c++) {
      const cell = rows[r].cells[c];
      while (grid[r][col] !== undefined) col++;
      const rowSpan = (cell as HTMLTableCellElement).rowSpan || 1;
      const colSpan = (cell as HTMLTableCellElement).colSpan || 1;
      for (let rr = 0; rr < rowSpan; rr++) {
        if (!grid[r + rr]) grid[r + rr] = [];
        for (let cc = 0; cc < colSpan; cc++) {
          grid[r + rr][col + cc] = cell;
        }
      }
      col += colSpan;
    }
  }
  return grid;
}

function normalizeSurgeonName(raw: string): string {
  // "Chen (CHEN-1032217)"  → "Chen"
  // "SINGH (SINGH-638665)" → "Singh"
  const before = raw.split('(')[0].trim();
  return before
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// Table layout produced by Google Sheets HTML export:
//   tbody row 0 → empty spacer
//   tbody row 1 → "Kaiser Permanente…" title
//   tbody row 2 → "Printed: M/D/YYYY …"   ← year extracted here
//   tbody row 3 → separator
//   tbody row 4 → date headers ("Jun 01", "Jun 06 - Jun 07", …)
//   tbody row 5+ → surgeon data rows
//
// Column layout (each row starts with a row-number <th>):
//   col 0 → row-number th  (skip)
//   col 1 → col A          (surgeon name cells with rowspan > 1)
//   col 2+ → date columns  (B, C, … AA)

export function parseHtmlSchedule(html: string): HtmlParseResult {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const table = doc.querySelector('table.waffle');
  if (!table) return { surgeons: [], dateRange: null };

  const tbody = table.querySelector('tbody');
  if (!tbody) return { surgeons: [], dateRange: null };

  const rows = tbody.rows;
  const grid = buildGrid(rows);

  // Extract year from "Printed: M/D/YYYY" cell (tbody row 2, col 1)
  let year = new Date().getFullYear();
  const printedText = grid[2]?.[1]?.textContent ?? '';
  const yearMatch = printedText.match(/(\d{4})/);
  if (yearMatch) year = parseInt(yearMatch[1], 10);

  // Build col-index → ISO date[] map from date header row (tbody index 4)
  const datesByCol = new Map<number, string[]>();
  const headerRow = grid[4];
  if (!headerRow) return { surgeons: [], dateRange: null };

  for (let col = 2; col < headerRow.length; col++) {
    const cell = headerRow[col];
    if (!cell) continue;
    const dates = parseDateCell(cell.textContent?.trim() ?? '', year);
    if (dates.length > 0) datesByCol.set(col, dates);
  }

  const allDates = [...datesByCol.values()].flat().sort();
  const dateRange =
    allDates.length > 0 ? { start: allDates[0], end: allDates[allDates.length - 1] } : null;

  const surgeons: ParsedSurgeon[] = [];

  for (let r = 5; r < grid.length; r++) {
    const nameCell = grid[r][1];
    if (!nameCell) continue;

    // Identify surgeon header cells by: rowspan > 1 and contains "(ID)" pattern.
    // This avoids relying on CSS colour classes.
    const cellEl = nameCell as HTMLTableCellElement;
    if ((cellEl.rowSpan ?? 1) <= 1) continue;
    const rawName = nameCell.textContent?.trim() ?? '';
    if (!/\(.+\)/.test(rawName)) continue;

    // Skip continuation rows (same cell reference repeated by buildGrid for rowspan)
    if (r > 5 && grid[r - 1]?.[1] === nameCell) continue;

    const name = normalizeSurgeonName(rawName);

    // Skip pool surgeon — they self-schedule via availableDates
    if (name.toLowerCase().startsWith('pool')) continue;

    const rowSpan = cellEl.rowSpan || 1;
    const robotBlocks: RobotBlock[] = [];
    const blackouts: BlackoutDate[] = [];
    const egsShifts: string[] = [];
    const seen = new Set<string>();

    for (let sr = r; sr < r + rowSpan; sr++) {
      const subRow = grid[sr];
      if (!subRow) continue;

      for (let col = 2; col < subRow.length; col++) {
        const cell = subRow[col];
        if (!cell) continue;
        const dates = datesByCol.get(col);
        if (!dates || dates.length === 0) continue;

        const constraint = classifyConstraint(cell.textContent?.trim() ?? '');
        if (!constraint) continue;

        for (const date of dates) {
          if (constraint.kind === 'robot') {
            const key = `rb:${date}:${constraint.assistingOnly}`;
            if (!seen.has(key)) {
              seen.add(key);
              robotBlocks.push({ date, assistingOnly: constraint.assistingOnly });
            }
          } else if (constraint.kind === 'egs') {
            const key = `egs:${date}`;
            if (!seen.has(key)) {
              seen.add(key);
              egsShifts.push(date);
            }
          } else {
            const key = `bo:${date}:${constraint.type}`;
            if (!seen.has(key)) {
              seen.add(key);
              blackouts.push({ date, type: constraint.type });
            }
          }
        }
      }
    }

    surgeons.push({ name, robotBlocks, blackouts, egsShifts });
  }

  return { surgeons, dateRange };
}

// ─── CSV constraint import ────────────────────────────────────────────────────
//
// CSV format (header required):
//   name,date,constraint
//   Chen,2026-06-01,AMC ROBOT
//   Chen,2026-06-02,AMC ROBOT ASSIST
//   Chen,2026-06-22,ATO
//   Douaiher,2026-06-03,NO DAY CALL
//
// Valid constraint values: AMC ROBOT · AMC ROBOT ASSIST ·
//   NO CALL · NO DAY CALL · ATO · VAC · OFF PM

export function parseCsvConstraints(csv: string): HtmlParseResult {
  const { data, errors } = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.trim().toLowerCase(),
  });

  if (errors.length > 0 && data.length === 0) return { surgeons: [], dateRange: null };

  const byName = new Map<string, { robotBlocks: RobotBlock[]; blackouts: BlackoutDate[]; egsShifts: string[] }>();
  const allDates: string[] = [];

  for (const row of data) {
    const rawName = (row['name'] ?? '').trim();
    const date = (row['date'] ?? '').trim();
    const constraintText = (row['constraint'] ?? '').trim();
    if (!rawName || !date || !constraintText) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    const constraint = classifyConstraint(constraintText);
    if (!constraint) continue;

    const name = normalizeSurgeonName(rawName);
    if (name.toLowerCase().startsWith('pool')) continue;

    if (!byName.has(name)) byName.set(name, { robotBlocks: [], blackouts: [], egsShifts: [] });
    const entry = byName.get(name)!;
    allDates.push(date);

    if (constraint.kind === 'robot') {
      entry.robotBlocks.push({ date, assistingOnly: constraint.assistingOnly });
    } else if (constraint.kind === 'egs') {
      entry.egsShifts.push(date);
    } else {
      entry.blackouts.push({ date, type: constraint.type });
    }
  }

  const surgeons: ParsedSurgeon[] = [...byName.entries()].map(([name, { robotBlocks, blackouts, egsShifts }]) => ({
    name,
    robotBlocks,
    blackouts,
    egsShifts,
  }));

  const sorted = allDates.sort();
  const dateRange = sorted.length > 0 ? { start: sorted[0], end: sorted[sorted.length - 1] } : null;

  return { surgeons, dateRange };
}

// ─── KP Block Schedule CSV import ────────────────────────────────────────────
//
// Handles the raw Google Sheets CSV export of the Kaiser block schedule:
//   Row 0: empty
//   Row 1: "Kaiser Permanente - Diablo Service Area - Surgery"
//   Row 2: "Printed: M/D/YYYY …"
//   Row 3: empty
//   Row 4: date header row  (col 0 empty, col 1+ = "Jun 01", "Jun 06 - Jun 07", …)
//   Row 5+: surgeon rows — col 0 = "Name (ID)", col 1+ = activity cells
//           continuation rows have col 0 empty

export function parseKpBlockScheduleCsv(csv: string): HtmlParseResult {
  const { data: rawData } = Papa.parse<string[]>(csv, { header: false, skipEmptyLines: false });

  // Find the date header row: first row where multiple cells match a month+day pattern
  let headerRowIdx = -1;
  for (let i = 0; i < rawData.length; i++) {
    const dateCells = rawData[i].filter(c => /^[A-Za-z]{3}\s+\d{1,2}/.test(c.trim()));
    if (dateCells.length >= 2) { headerRowIdx = i; break; }
  }
  if (headerRowIdx === -1) return { surgeons: [], dateRange: null };

  // Extract year from "Printed: M/D/YYYY" in the rows before the header
  let year = new Date().getFullYear();
  for (let i = 0; i < headerRowIdx; i++) {
    const m = rawData[i].join(' ').match(/(\d{4})/);
    if (m) { year = parseInt(m[1], 10); break; }
  }

  // Build col-index → ISO date(s) map
  const headerRow = rawData[headerRowIdx];
  const datesByCol = new Map<number, string[]>();
  for (let col = 1; col < headerRow.length; col++) {
    const dates = parseDateCell(headerRow[col]?.trim() ?? '', year);
    if (dates.length > 0) datesByCol.set(col, dates);
  }

  const surgeons: ParsedSurgeon[] = [];
  let currentName: string | null = null;
  let currentRobot: RobotBlock[] = [];
  let currentBlackouts: BlackoutDate[] = [];
  let currentEgs: string[] = [];
  const seen = new Set<string>();

  function flushSurgeon() {
    if (!currentName) return;
    surgeons.push({ name: currentName, robotBlocks: currentRobot, blackouts: currentBlackouts, egsShifts: currentEgs });
    currentName = null;
    currentRobot = [];
    currentBlackouts = [];
    currentEgs = [];
    seen.clear();
  }

  function processRow(row: string[]) {
    for (let col = 1; col < row.length; col++) {
      const cell = row[col]?.trim() ?? '';
      if (!cell) continue;
      const dates = datesByCol.get(col);
      if (!dates?.length) continue;
      const constraint = classifyConstraint(cell);
      if (!constraint) continue;
      for (const date of dates) {
        if (constraint.kind === 'robot') {
          const key = `rb:${date}:${constraint.assistingOnly}`;
          if (!seen.has(key)) { seen.add(key); currentRobot.push({ date, assistingOnly: constraint.assistingOnly }); }
        } else if (constraint.kind === 'egs') {
          const key = `egs:${date}`;
          if (!seen.has(key)) { seen.add(key); currentEgs.push(date); }
        } else {
          const key = `bo:${date}:${constraint.type}`;
          if (!seen.has(key)) { seen.add(key); currentBlackouts.push({ date, type: constraint.type }); }
        }
      }
    }
  }

  for (let r = headerRowIdx + 1; r < rawData.length; r++) {
    const row = rawData[r];
    const firstCell = row[0]?.trim() ?? '';

    if (firstCell && /\(.+\)/.test(firstCell)) {
      flushSurgeon();
      const name = normalizeSurgeonName(firstCell);
      if (name.toLowerCase().startsWith('pool')) { currentName = null; continue; }
      currentName = name;
    }

    if (currentName) processRow(row);
  }
  flushSurgeon();

  const allDates = [...datesByCol.values()].flat().sort();
  const dateRange = allDates.length > 0 ? { start: allDates[0], end: allDates[allDates.length - 1] } : null;

  return { surgeons, dateRange };
}

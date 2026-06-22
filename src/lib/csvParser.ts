import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import type { Surgeon, BlackoutDate, RobotBlock, SurgeonPreferences, CSVSurgeonRow } from '../types';
import { defaultPreferences } from '../types';

function parseDate(s: string): string | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
}

function parsePipeList(s: string): string[] {
  if (!s || !s.trim()) return [];
  return s.split('|').map(v => v.trim()).filter(Boolean);
}

function parseBlackouts(field: string, type: BlackoutDate['type']): BlackoutDate[] {
  return parsePipeList(field)
    .map(d => parseDate(d))
    .filter((d): d is string => d !== null)
    .map(date => ({ date, type }));
}

function parseRobotBlocks(field: string): RobotBlock[] {
  return parsePipeList(field)
    .map(entry => {
      const [datePart, assistPart] = entry.split(':');
      const date = parseDate(datePart);
      if (!date) return null;
      const assistingOnly = assistPart?.trim().toLowerCase() === 'true';
      return { date, assistingOnly };
    })
    .filter((r): r is RobotBlock => r !== null);
}

function parsePreferences(row: CSVSurgeonRow): SurgeonPreferences {
  const raw = row.shift_preference?.trim().toLowerCase() ?? '';
  const shiftPreference: SurgeonPreferences['shiftPreference'] =
    raw === '24h' ? '24H' : raw === '12h' ? '12H' : 'none';
  return {
    shiftPreference,
    customNotes: row.custom_preferences?.trim() ?? '',
    maxOcd: null,
    maxOcn: null,
    max24h: null,
  };
}

function rowToSurgeon(row: CSVSurgeonRow): Surgeon | null {
  const name = row.name?.trim();
  if (!name) return null;

  const rawType = row.type?.trim().toUpperCase();
  if (rawType !== 'EGS' && rawType !== 'NON_EGS' && rawType !== 'POOL') return null;
  const type = rawType as Surgeon['type'];

  const blackouts: BlackoutDate[] = [
    ...parseBlackouts(row.ocd_blackouts ?? '', 'OCD'),
    ...parseBlackouts(row.ocn_blackouts ?? '', 'OCN'),
    ...parseBlackouts(row.both_blackouts ?? '', 'BOTH'),
  ];

  const availableDates =
    type === 'POOL'
      ? parsePipeList(row.available_dates ?? '')
          .map(d => parseDate(d))
          .filter((d): d is string => d !== null)
          .slice(0, 6)
      : undefined;

  return {
    id: uuidv4(),
    name,
    type,
    blackouts: type === 'POOL' ? [] : blackouts,
    robotBlocks: type === 'POOL' ? [] : parseRobotBlocks(row.robot_blocks ?? ''),
    preferences: parsePreferences(row),
    ...(availableDates !== undefined ? { availableDates } : {}),
  };
}

export interface ParseResult {
  surgeons: Surgeon[];
  errors: string[];
}

export function parseCSV(file: File): Promise<ParseResult> {
  return new Promise(resolve => {
    Papa.parse<CSVSurgeonRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const errors: string[] = [];
        const surgeons: Surgeon[] = [];

        results.errors.forEach(e => errors.push(`Row ${e.row}: ${e.message}`));

        results.data.forEach((row, i) => {
          const surgeon = rowToSurgeon(row);
          if (!surgeon) {
            errors.push(`Row ${i + 2}: Invalid name or type (must be EGS, NON_EGS, or POOL)`);
          } else {
            surgeons.push(surgeon);
          }
        });

        resolve({ surgeons, errors });
      },
    });
  });
}

void defaultPreferences; // re-exported for consumers that need the default

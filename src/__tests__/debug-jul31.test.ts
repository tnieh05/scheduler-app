import { describe, it } from 'vitest';
import { generateSchedule } from '../engine/generator';

function makeSurgeon(name: string, type: 'EGS' | 'NON_EGS') {
  return { id: name.toLowerCase().replace(/\s/g, '-'), name, type, blackouts: [], robotBlocks: [], preferences: { shiftPreference: 'none' as const, customNotes: '' } };
}

const SURGEONS = [
  makeSurgeon('Dr. A', 'EGS'), makeSurgeon('Dr. B', 'EGS'), makeSurgeon('Dr. C', 'EGS'),
  makeSurgeon('Dr. D', 'EGS'), makeSurgeon('Dr. E', 'EGS'), makeSurgeon('Dr. F', 'EGS'),
  makeSurgeon('Dr. G', 'EGS'), makeSurgeon('Dr. H', 'EGS'),
  makeSurgeon('Dr. I', 'NON_EGS'), makeSurgeon('Dr. J', 'NON_EGS'), makeSurgeon('Dr. K', 'NON_EGS'),
];

describe('debug', () => {
  it('shows all July shifts and phase-2 24H assignments', () => {
    const schedule = generateSchedule(SURGEONS, { start: '2026-07-01', end: '2026-09-30' });

    // All 24H shifts in July (to understand Phase 2 output)
    console.log('\n--- All July 24H shifts ---');
    const july24H = schedule.shifts.filter(s => s.date >= '2026-07-01' && s.date <= '2026-07-31' && s.kind === '24H');
    for (const s of july24H.sort((a, b) => a.date.localeCompare(b.date))) {
      const name = SURGEONS.find(x => x.id === s.surgeonId)?.name ?? s.surgeonId;
      console.log(s.date, name);
    }

    // All shifts Jul 25-Aug 5
    console.log('\n--- Shifts Jul 25 – Aug 5 ---');
    const window = schedule.shifts.filter(s => s.date >= '2026-07-25' && s.date <= '2026-08-05');
    const byDate = new Map<string, string[]>();
    for (const s of window) {
      const name = SURGEONS.find(x => x.id === s.surgeonId)?.name ?? s.surgeonId;
      const arr = byDate.get(s.date) ?? [];
      arr.push(`${name}(${s.kind})`);
      byDate.set(s.date, arr);
    }
    for (const d of [...byDate.keys()].sort()) {
      console.log(d, byDate.get(d)?.join(' | '));
    }

    // Per-surgeon July quota summary: h24 / ocd / ocn
    console.log('\n--- July quota usage per surgeon ---');
    for (const s of SURGEONS) {
      const jul = schedule.shifts.filter(x => x.surgeonId === s.id && x.date >= '2026-07-01' && x.date <= '2026-07-31');
      const h24 = jul.filter(x => x.kind === '24H').length;
      const ocd = jul.filter(x => x.kind === 'OCD').length;
      const ocn = jul.filter(x => x.kind === 'OCN').length;
      const wknd = jul.filter(x => ['OCD','OCN','24H'].includes(x.kind) && ['0','5','6'].includes(String(new Date(x.date + 'T12:00:00Z').getUTCDay())));
      console.log(`${s.name}: h24=${h24} ocd=${ocd} ocn=${ocn} weekends=[${wknd.map(x=>x.date).join(',')}]`);
    }

    // EGS assignments
    console.log('\n--- EGS assignments (Jul-Aug) ---');
    const egs = schedule.shifts.filter(s => s.kind === 'EGS' && s.date >= '2026-07-01' && s.date <= '2026-08-31');
    for (const s of egs) {
      const name = SURGEONS.find(x => x.id === s.surgeonId)?.name ?? s.surgeonId;
      console.log(name, s.date, '–', s.endDate);
    }

    // Shifts in first week of August (to see what blocks Jul 31 candidates via forward rest)
    console.log('\n--- Aug 1-5 shifts (forward-rest context for Jul 31) ---');
    const aug = schedule.shifts.filter(s => s.date >= '2026-08-01' && s.date <= '2026-08-05');
    const byDateAug = new Map<string, string[]>();
    for (const s of aug) {
      const name = SURGEONS.find(x => x.id === s.surgeonId)?.name ?? s.surgeonId;
      const arr = byDateAug.get(s.date) ?? [];
      arr.push(`${name}(${s.kind})`);
      byDateAug.set(s.date, arr);
    }
    for (const d of [...byDateAug.keys()].sort()) {
      console.log(d, byDateAug.get(d)?.join(' | '));
    }
  });
});

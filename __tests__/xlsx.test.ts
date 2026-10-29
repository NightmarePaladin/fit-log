import { strFromU8, unzipSync } from 'fflate';
import { buildHistorySheets, buildPlanSheet, fileSafe, isoDay } from '../src/lib/exports';
import { localToRow } from '../src/lib/localData';
import { makeUnitFormat } from '../src/lib/units';
import { buildXlsx, columnLetter, safeSheetName } from '../src/lib/xlsx';
import type { LocalWorkout } from '../src/types';

const read = (bytes: Uint8Array) => {
  const files = unzipSync(bytes);
  return Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strFromU8(v)]));
};

describe('xlsx writer', () => {
  it('produces a valid package: required parts, sheets, relationships', () => {
    const f = read(buildXlsx([{ name: 'A', rows: [['x']] }, { name: 'B', rows: [['y']] }]));
    expect(Object.keys(f)).toEqual(
      expect.arrayContaining([
        '[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml',
        'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml',
      ]),
    );
    expect(f['xl/workbook.xml']).toContain('name="A"');
    expect(f['xl/workbook.xml']).toContain('name="B"');
    expect(f['[Content_Types].xml']).toContain('/xl/worksheets/sheet2.xml');
    expect(f['xl/_rels/workbook.xml.rels']).toContain('worksheets/sheet2.xml');
    expect(f['xl/_rels/workbook.xml.rels']).toContain('styles.xml');
  });

  it('writes numbers as numbers and text as escaped inline strings', () => {
    const f = read(buildXlsx([{ name: 'S', rows: [['Curls & "Presses" <heavy>', 225, 62.5]] }]));
    const sheet = f['xl/worksheets/sheet1.xml'];
    expect(sheet).toContain('Curls &amp; &quot;Presses&quot; &lt;heavy&gt;');
    expect(sheet).toContain('<c r="B1"><v>225</v></c>');
    expect(sheet).toContain('<c r="C1"><v>62.5</v></c>');
    expect(sheet).not.toContain('<heavy>');
  });

  it('strips characters that are illegal in XML and keeps unicode', () => {
    const sheet = read(buildXlsx([{ name: 'S', rows: [['bad\u0001char — ok ✓']] }]))['xl/worksheets/sheet1.xml'];
    expect(sheet).toContain('badchar — ok ✓');
  });

  it('applies styles, widths and a frozen header row', () => {
    const f = read(
      buildXlsx([{ name: 'S', rows: [[{ v: 'H', style: 'header' }, { v: null, style: 'input' }]], colWidths: [20, 10], freezeRows: 1 }]),
    );
    const sheet = f['xl/worksheets/sheet1.xml'];
    expect(sheet).toContain('s="1"');
    expect(sheet).toContain('<c r="B1" s="3"/>');
    expect(sheet).toContain('<col min="1" max="1" width="20" customWidth="1"/>');
    expect(sheet).toContain('state="frozen"');
    expect(sheet.indexOf('<sheetViews>')).toBeLessThan(sheet.indexOf('<cols>')); // element order matters to Excel
    expect(sheet.indexOf('<cols>')).toBeLessThan(sheet.indexOf('<sheetData>'));
  });

  it('column letters and safe, unique sheet names', () => {
    expect([0, 1, 25, 26, 27, 701, 702].map(columnLetter)).toEqual(['A', 'B', 'Z', 'AA', 'AB', 'ZZ', 'AAA']);
    const taken = new Set<string>();
    expect(safeSheetName('Plan/2026: [draft]?', taken)).toBe('Plan 2026 draft');
    expect(safeSheetName('plan 2026 draft', taken)).toBe('plan 2026 draft 2');
    expect(safeSheetName('x'.repeat(50), new Set())).toHaveLength(31);
  });

  it('rejects an empty workbook', () => {
    expect(() => buildXlsx([])).toThrow();
  });
});

const workout = (id: string, completedAt: string, name = 'Lower A'): LocalWorkout => ({
  id, ownerId: 'u', name, startedAt: completedAt, completedAt,
  exercises: [
    { exerciseId: 'sq', name: 'Barbell Squat', sets: [{ weight: 225, reps: 10, completed: true }, { weight: 225, reps: 8, completed: false }] },
    { exerciseId: 'pu', name: 'Push-Up', repsOnly: true, sets: [{ weight: 0, reps: 20, completed: true }] },
  ],
});

describe('plan and history exports', () => {
  const lb = makeUnitFormat('lb');
  it('plan: last numbers prefilled, blank target cells, reps-only has no weight target', () => {
    const sheet = buildPlanSheet(localToRow(workout('w1', '2026-10-28T20:00:00')), lb);
    expect(sheet.name).toBe('Plan');
    expect((sheet.rows[0][0] as { v: string }).v).toBe('Workout plan: Lower A');
    const header = sheet.rows[3].map((c) => (c as { v: string }).v);
    expect(header).toEqual(['Exercise', 'Set', 'Last weight (lb)', 'Last reps', 'Target weight (lb)', 'Target reps', 'Done', 'Notes']);
    const squat1 = sheet.rows[4];
    expect(squat1.slice(0, 4)).toEqual(['Barbell Squat', 1, 225, 10]);
    expect(squat1[4]).toEqual({ v: null, style: 'input' }); // blank target weight
    const pushup = sheet.rows[6];
    expect(pushup.slice(0, 4)).toEqual(['Push-Up', 1, '—', 20]);
    expect(pushup[4]).toEqual({ v: '—', style: 'muted' });
    expect(sheet.freezeRows).toBe(4);
  });

  it('plan converts weights to kg when that is the chosen unit', () => {
    const sheet = buildPlanSheet(localToRow(workout('w1', '2026-10-28T20:00:00')), makeUnitFormat('kg'));
    expect(sheet.rows[4][2]).toBe(102.06);
    expect((sheet.rows[3][2] as { v: string }).v).toBe('Last weight (kg)');
  });

  it('history: one row per workout and per set, oldest first, completed flag and volume', () => {
    const [summary, sets] = buildHistorySheets(
      [localToRow(workout('b', '2026-10-28T20:00:00', 'Later')), localToRow(workout('a', '2026-10-20T20:00:00', 'Earlier'))],
      lb,
    );
    expect(summary.name).toBe('Workouts');
    expect(summary.rows[1][1]).toBe('Earlier');
    expect(summary.rows[2][1]).toBe('Later');
    // Earlier: squat 225x10 completed (2250) + pushup 20 reps; the 8-rep set is not completed
    expect(summary.rows[1].slice(2)).toEqual([2, 2, 30, '', 2250]);
    expect(sets.rows.length).toBe(1 + 2 * 3);
    const incomplete = sets.rows.find((r) => r[6] === 'No')!;
    expect(incomplete[7]).toBe(0);
    expect(sets.rows[1][0]).toBe('2026-10-20');
  });

  it('helpers: local-day format and safe file names', () => {
    expect(isoDay(null)).toBe('');
    expect(isoDay(new Date(2026, 9, 5, 23, 30).toISOString())).toBe('2026-10-05');
    expect(fileSafe('Lower A / Legs!')).toBe('Lower-A-Legs');
    expect(fileSafe('///')).toBe('workout');
  });

  it('end to end: a plan workbook round-trips through zip', () => {
    const f = read(buildXlsx([buildPlanSheet(localToRow(workout('w1', '2026-10-28T20:00:00')), lb)]));
    const sheet = f['xl/worksheets/sheet1.xml'];
    expect(sheet).toContain('Workout plan: Lower A');
    expect(sheet).toContain('Barbell Squat');
    expect(sheet).toContain('state="frozen"');
  });
});

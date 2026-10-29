import { exerciseRepsOnly, exerciseTimed, workoutToDraftExercises, workoutTotals } from '../src/lib/history';
import { draftToLocal, localToRow } from '../src/lib/localData';
import { buildHistorySheets, buildPlanSheet } from '../src/lib/exports';
import { buildShareCard, describeSets } from '../src/lib/shareCard';
import { formatDuration, makeUnitFormat, repsModeOf } from '../src/lib/units';
import { elapsedMs } from '../src/store/timer';
import type { Draft } from '../src/types';

const lb = makeUnitFormat('lb');

const draft: Draft = {
  startedAt: '2026-10-28T10:00:00.000Z',
  name: 'Cardio day',
  exercises: [
    { key: 'r', exerciseId: 'run', name: 'Run', repsOnly: 'time', sets: [{ key: 's1', weight: '', reps: '1500', completed: true }] },
    { key: 'p', exerciseId: 'pushup', name: 'Push-Up', repsOnly: true, sets: [{ key: 's2', weight: '', reps: '20', completed: true }] },
    { key: 'b', exerciseId: 'bench', name: 'Bench', repsOnly: false, sets: [{ key: 's3', weight: '100', reps: '5', completed: true }] },
  ],
};
const row = localToRow(draftToLocal(draft, 'lb', 'w1', 'u1'));

describe('timed exercises', () => {
  it('formats durations as m:ss and h:mm:ss', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(75)).toBe('1:15');
    expect(formatDuration(1500)).toBe('25:00');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatDuration(-5)).toBe('0:00');
  });

  it('works out the mode from the exercise flags', () => {
    expect(repsModeOf({ reps_only: true, timed: true })).toBe('time');
    expect(repsModeOf({ reps_only: true })).toBe(true);
    expect(repsModeOf({})).toBe(false);
    expect(repsModeOf(null)).toBe(false);
  });

  it('a timed set shows a clock, other sets are unchanged', () => {
    expect(lb.setOrReps(0, 754, 'time')).toBe('12:34');
    expect(lb.setOrReps(0, 12, true)).toBe('12 reps');
    expect(lb.setOrReps(135, 10, false)).toBe('135 × 10');
  });

  it('keeps the flags through save, reload and "copy workout"', () => {
    const local = draftToLocal(draft, 'lb', 'w1', 'u1');
    expect(local.exercises.map((e) => e.repsOnly)).toEqual(['time', true, false]);
    const run = row.workout_exercises[0].exercises;
    expect(run).toMatchObject({ reps_only: true, timed: true });
    expect(row.workout_exercises[1].exercises?.timed).toBe(false);
    expect(workoutToDraftExercises(row).map((e) => e.repsOnly)).toEqual(['time', true, false]);
    expect(exerciseTimed([row])).toEqual(new Set(['run']));
    expect(exerciseRepsOnly([row])).toEqual(new Set(['run', 'pushup']));
  });

  it('seconds stay out of the rep count and are reported as time', () => {
    const t = workoutTotals(row);
    expect(t.reps).toBe(25); // 20 push-ups + 5 bench reps, NOT 1,500 seconds
    expect(t.seconds).toBe(1500);
    expect(t.volume).toBe(500);
  });

  it('the share card reads "25:00" and totals the time', () => {
    expect(describeSets([{ weight: 0, reps: 1500, completed: true }, { weight: 0, reps: 60, completed: true }], 'time', lb)).toBe('25:00 · 1:00');
    const card = buildShareCard(row, lb, 'Sam');
    expect(card.rows[0]).toEqual({ name: 'Run', detail: '25:00' });
    const cardioOnly = buildShareCard({ ...row, workout_exercises: [row.workout_exercises[0]] }, lb, 'Sam');
    expect(cardioOnly.total).toBe('25:00 total time');
  });

  it('the Excel exports show durations, not thousands of "reps"', () => {
    const plan = buildPlanSheet(row, lb);
    expect(plan.rows[4][3]).toBe('25:00'); // "Last reps" column of the Run row
    const sheets = buildHistorySheets([row], lb);
    const sets = sheets[1].rows;
    expect(sets[1][5]).toBe('25:00');
    expect(sets[1][7]).toBe(0); // no volume for a timed set
    expect(sheets[0].rows[1][5]).toBe('25:00'); // total time column
  });

  it('the stopwatch counts across pauses', () => {
    expect(elapsedMs({ startedAt: null, accMs: 4000 }, 99999)).toBe(4000);
    expect(elapsedMs({ startedAt: 10_000, accMs: 4000 }, 12_500)).toBe(6500);
  });
});

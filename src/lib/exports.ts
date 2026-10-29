import { formatDuration, repsModeOf, type UnitFormat } from './units';
import { workoutTotals } from './history';
import type { Cell, Sheet } from './xlsx';
import type { WorkoutRow } from '../types';

/** Local calendar day as YYYY-MM-DD (so a late-evening workout isn't filed under tomorrow). */
export function isoDay(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export const fileSafe = (s: string) =>
  s.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'workout';

const byPosition = (w: WorkoutRow) => [...w.workout_exercises].sort((a, b) => a.position - b.position);

/**
 * A workout PLAN: the exercises and sets of a saved workout, with what you did last time and blank yellow cells
 * to fill in with targets for next time.
 */
export function buildPlanSheet(w: WorkoutRow, u: UnitFormat): Sheet {
  const header = (t: string): Cell => ({ v: t, style: 'header' });
  const input = (): Cell => ({ v: null, style: 'input' });
  const rows: Cell[][] = [
    [{ v: `Workout plan: ${w.name || 'Workout'}`, style: 'title' }],
    [{ v: `Based on your workout on ${isoDay(w.completed_at)}. Fill in the yellow cells, then log it in Fit Lift. Weights in ${u.label}.`, style: 'muted' }],
    [],
    [
      header('Exercise'), header('Set'), header(`Last weight (${u.label})`), header('Last reps'),
      header(`Target weight (${u.label})`), header('Target reps'), header('Done'), header('Notes'),
    ],
  ];
  for (const we of byPosition(w)) {
    const mode = repsModeOf(we.exercises);
    const repsOnly = !!mode;
    const sets = [...we.workout_sets].sort((a, b) => a.set_order - b.set_order);
    sets.forEach((s, i) => {
      rows.push([
        we.exercises?.name ?? 'Exercise',
        i + 1,
        repsOnly && Number(s.weight) === 0 ? '—' : u.w(Number(s.weight)),
        mode === 'time' ? formatDuration(s.reps) : s.reps,
        repsOnly ? { v: '—', style: 'muted' } : input(),
        input(),
        input(),
        input(),
      ]);
    });
  }
  return { name: 'Plan', rows, colWidths: [30, 6, 18, 11, 20, 13, 8, 30], freezeRows: 4 };
}

/** Two sheets: one row per workout, and one row per set. Oldest first. */
export function buildHistorySheets(workouts: WorkoutRow[], u: UnitFormat): Sheet[] {
  const header = (t: string): Cell => ({ v: t, style: 'header' });
  const sorted = [...workouts]
    .filter((w) => w.completed_at)
    .sort((a, b) => new Date(a.completed_at!).getTime() - new Date(b.completed_at!).getTime());

  const summary: Cell[][] = [
    [header('Date'), header('Workout'), header('Exercises'), header('Sets'), header('Total reps'), header('Total time'), header(`Volume (${u.label})`)],
  ];
  const sets: Cell[][] = [
    [header('Date'), header('Workout'), header('Exercise'), header('Set'), header(`Weight (${u.label})`), header('Reps / time'), header('Completed'), header(`Volume (${u.label})`)],
  ];
  for (const w of sorted) {
    const t = workoutTotals(w);
    summary.push([isoDay(w.completed_at), w.name || 'Workout', w.workout_exercises.length, t.sets, t.reps, t.seconds > 0 ? formatDuration(t.seconds) : '', Math.round(u.w(t.volume))]);
    for (const we of byPosition(w)) {
      const mode = repsModeOf(we.exercises);
      const repsOnly = !!mode;
      for (const s of [...we.workout_sets].sort((a, b) => a.set_order - b.set_order)) {
        const weight = Number(s.weight);
        sets.push([
          isoDay(w.completed_at),
          w.name || 'Workout',
          we.exercises?.name ?? 'Exercise',
          s.set_order,
          repsOnly && weight === 0 ? '—' : u.w(weight),
          mode === 'time' ? formatDuration(s.reps) : s.reps,
          s.completed ? 'Yes' : 'No',
          s.completed && mode !== 'time' ? Math.round(u.w(weight * s.reps)) : 0,
        ]);
      }
    }
  }
  return [
    { name: 'Workouts', rows: summary, colWidths: [12, 24, 11, 7, 11, 12, 16], freezeRows: 1 },
    { name: 'Sets', rows: sets, colWidths: [12, 24, 28, 6, 16, 8, 11, 16], freezeRows: 1 },
  ];
}

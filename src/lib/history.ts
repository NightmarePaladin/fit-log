import { volume } from './stats';
import { toDisplay, trimNum, type Unit } from './units';
import type { DraftExercise, FlatSet, WorkoutRow } from '../types';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/** One row per set, tagged with the workout's completion time (used by stats). */
export function flattenWorkouts(workouts: WorkoutRow[]): FlatSet[] {
  const out: FlatSet[] = [];
  for (const w of workouts) {
    if (!w.completed_at) continue;
    for (const we of w.workout_exercises) {
      for (const s of we.workout_sets) {
        out.push({
          exerciseId: we.exercise_id,
          workoutId: w.id,
          completedAt: w.completed_at,
          weight: Number(s.weight),
          reps: s.reps,
          completed: s.completed,
        });
      }
    }
  }
  return out;
}

export function exerciseNames(workouts: WorkoutRow[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const w of workouts)
    for (const we of w.workout_exercises) if (we.exercises) m.set(we.exercise_id, we.exercises.name);
  return m;
}

export type PrevSet = { weight: number; reps: number };

/**
 * For each exercise, the sets from the most recent completed workout that contained it.
 * `workouts` must be sorted newest first. `excludeId` skips the workout being edited.
 */
export function previousByExercise(workouts: WorkoutRow[], excludeId?: string): Map<string, PrevSet[]> {
  const m = new Map<string, PrevSet[]>();
  for (const w of workouts) {
    if (w.id === excludeId) continue;
    for (const we of w.workout_exercises) {
      if (m.has(we.exercise_id)) continue;
      const sets = [...we.workout_sets]
        .sort((a, b) => a.set_order - b.set_order)
        .map((s) => ({ weight: Number(s.weight), reps: s.reps }));
      if (sets.length) m.set(we.exercise_id, sets);
    }
  }
  return m;
}

/** Copy a saved workout into draft exercises. Sets start uncompleted so they're re-earned. */
export function workoutToDraftExercises(w: WorkoutRow, keepCompleted = false, unit: Unit = 'lb'): DraftExercise[] {
  return [...w.workout_exercises]
    .sort((a, b) => a.position - b.position)
    .map((we) => ({
      key: uid(),
      exerciseId: we.exercise_id,
      name: we.exercises?.name ?? 'Exercise',
      repsOnly: !!we.exercises?.reps_only,
      sets: [...we.workout_sets]
        .sort((a, b) => a.set_order - b.set_order)
        .map((s) => ({
          key: uid(),
          weight: trimNum(toDisplay(Number(s.weight), unit)),
          reps: String(s.reps),
          completed: keepCompleted ? s.completed : false,
        })),
    }));
}

/** Ids of reps-only (bodyweight) exercises seen in these workouts. */
export function exerciseRepsOnly(workouts: WorkoutRow[]): Set<string> {
  const out = new Set<string>();
  for (const w of workouts)
    for (const we of w.workout_exercises) if (we.exercises?.reps_only) out.add(we.exercise_id);
  return out;
}

export function workoutTotals(w: WorkoutRow) {
  const sets = w.workout_exercises.flatMap((we) =>
    we.workout_sets.map((s) => ({ weight: Number(s.weight), reps: s.reps, completed: s.completed })),
  );
  const done = sets.filter((s) => s.completed);
  return { volume: volume(sets), sets: done.length, reps: done.reduce((n, s) => n + s.reps, 0) };
}

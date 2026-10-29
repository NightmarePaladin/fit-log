import { LIBRARY } from '../data/library';
import { toLb, type Unit } from './units';
import type { Draft, Exercise, LocalExercise, LocalWorkout, WorkoutRow } from '../types';

const num = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/** Turn the typed draft (weights in the display unit) into a device-stored workout (weights in lb). */
export function draftToLocal(draft: Draft, unit: Unit, id: string, ownerId: string | null): LocalWorkout {
  const exercises = draft.exercises
    .map((ex) => ({
      exerciseId: ex.exerciseId,
      name: ex.name,
      repsOnly: !!ex.repsOnly,
      sets: ex.sets
        .filter((s) => s.completed || num(s.reps) > 0 || num(s.weight) > 0)
        .map((s) => ({ weight: toLb(num(s.weight), unit), reps: Math.round(num(s.reps)), completed: s.completed })),
    }))
    .filter((ex) => ex.sets.length > 0);
  if (exercises.length === 0) throw new Error('Add at least one set before saving.');
  return {
    id,
    ownerId,
    name: draft.name,
    startedAt: draft.startedAt,
    completedAt: draft.completedAt ?? new Date().toISOString(),
    exercises,
  };
}

/** Shape a device-stored workout like a server row so History, Progress and Last Workout can use it. */
export function localToRow(w: LocalWorkout): WorkoutRow {
  return {
    id: w.id,
    name: w.name || null,
    started_at: w.startedAt,
    completed_at: w.completedAt,
    status: 'completed',
    pending: true,
    workout_exercises: w.exercises.map((ex, i) => ({
      id: `${w.id}:${i}`,
      position: i + 1,
      exercise_id: ex.exerciseId,
      exercises: { name: ex.name, reps_only: !!ex.repsOnly },
      workout_sets: ex.sets.map((s, j) => ({
        id: `${w.id}:${i}:${j}`,
        exercise_id: ex.exerciseId,
        set_order: j + 1,
        weight: s.weight,
        reps: s.reps,
        completed: s.completed,
      })),
    })),
  };
}

/**
 * Which device-stored items a viewer may see: a signed-in user sees only their own;
 * offline (no account) mode shows everything waiting on this device.
 */
export function visibleTo<T extends { ownerId: string | null }>(items: T[], userId: string | null): T[] {
  return userId ? items.filter((i) => i.ownerId === userId) : items;
}

/** Server rows plus device-stored workouts, newest first. A device copy replaces the server copy with the same id. */
export function mergeWorkouts(server: WorkoutRow[], pending: LocalWorkout[]): WorkoutRow[] {
  const pendingIds = new Set(pending.map((p) => p.id));
  return [...pending.map(localToRow), ...server.filter((w) => !pendingIds.has(w.id))].sort(
    (a, b) => new Date(b.completed_at ?? 0).getTime() - new Date(a.completed_at ?? 0).getTime(),
  );
}

/** Exercise list usable with no connection: bundled library + cached custom + custom made offline. */
export function offlineExercises(
  userId: string | null,
  cachedCustom: Exercise[] = [],
  pendingCustom: LocalExercise[] = [],
): Exercise[] {
  const mine = visibleTo(pendingCustom, userId);
  const byId = new Map<string, Exercise>();
  for (const e of [...LIBRARY, ...cachedCustom, ...mine]) byId.set(e.id, e);
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Replace exercise ids (used when an offline custom exercise turns out to already exist on the server). */
export function remapExercises(w: LocalWorkout, remap: Map<string, string>): LocalWorkout {
  if (remap.size === 0) return w;
  return { ...w, exercises: w.exercises.map((e) => ({ ...e, exerciseId: remap.get(e.exerciseId) ?? e.exerciseId })) };
}

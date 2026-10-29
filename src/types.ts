export type Exercise = {
  id: string;
  user_id: string | null;
  name: string;
  muscle_group: string | null;
  is_custom: boolean;
  /** bodyweight exercise: logged with reps only (no weight) */
  reps_only?: boolean;
  /** timed exercise (running, plank...): a set's `reps` holds seconds. Always also reps_only. */
  timed?: boolean;
};

/** A set as stored/used in stats. */
export type SetRecord = {
  weight: number;
  reps: number;
  completed: boolean;
};

/** A finished (or in-draft) workout flattened for stats: one row per set. */
export type FlatSet = SetRecord & {
  exerciseId: string;
  workoutId: string;
  completedAt: string; // ISO timestamp of the workout
};

export type DraftSet = {
  key: string;
  weight: string; // kept as strings while typing
  reps: string;
  completed: boolean;
};

export type DraftExercise = {
  key: string;
  exerciseId: string;
  name: string;
  sets: DraftSet[];
  /** reps-only (bodyweight) exercise: no weight box; 'time' = timed set (minutes + seconds) */
  repsOnly?: boolean | 'time';
};

export type Draft = {
  startedAt: string;
  name: string;
  exercises: DraftExercise[];
  /** set when editing an already-saved workout */
  editingWorkoutId?: string;
  /** original completion time, preserved when editing */
  completedAt?: string;
};

export type WorkoutSetRow = {
  id: string;
  exercise_id: string;
  set_order: number;
  weight: number;
  reps: number;
  completed: boolean;
};

export type WorkoutExerciseRow = {
  id: string;
  position: number;
  exercise_id: string;
  exercises: { name: string; reps_only?: boolean; timed?: boolean } | null;
  workout_sets: WorkoutSetRow[];
};

export type WorkoutRow = {
  id: string;
  name: string | null;
  started_at: string;
  completed_at: string | null;
  status: 'in_progress' | 'completed';
  workout_exercises: WorkoutExerciseRow[];
  /** true for workouts saved on this device that are not uploaded yet */
  pending?: boolean;
};

/** A saved set; weight is in pounds (the canonical stored unit). */
export type LocalSet = { weight: number; reps: number; completed: boolean };

export type LocalWorkoutExercise = { exerciseId: string; name: string; sets: LocalSet[]; repsOnly?: boolean | 'time' };

/**
 * A workout saved on this device that has not been uploaded yet.
 * `id` is generated on the device and reused as the database id, so uploading is safe to repeat.
 * ownerId is null for workouts made in offline (guest) mode.
 */
export type LocalWorkout = {
  id: string;
  ownerId: string | null;
  name: string;
  startedAt: string;
  completedAt: string;
  exercises: LocalWorkoutExercise[];
  /** last upload error that was not a connectivity problem */
  error?: string;
};

/** A custom exercise created while offline, waiting to be uploaded. */
export type LocalExercise = Exercise & { ownerId: string | null };

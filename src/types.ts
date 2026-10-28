export type Exercise = {
  id: string;
  user_id: string | null;
  name: string;
  muscle_group: string | null;
  is_custom: boolean;
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
  exercises: { name: string } | null;
  workout_sets: WorkoutSetRow[];
};

export type WorkoutRow = {
  id: string;
  name: string | null;
  started_at: string;
  completed_at: string | null;
  status: 'in_progress' | 'completed';
  workout_exercises: WorkoutExerciseRow[];
};

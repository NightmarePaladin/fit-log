import { supabase } from '../lib/supabase';
import { toLb, type Unit } from '../lib/units';
import type { Draft, Exercise, WorkoutRow } from '../types';

const num = (s: string) => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

export async function fetchExercises(): Promise<Exercise[]> {
  const { data, error } = await supabase.from('exercises').select('*').order('name');
  if (error) throw error;
  return data as Exercise[];
}

export async function createExercise(name: string, muscleGroup: string | null, userId: string): Promise<Exercise> {
  const { data, error } = await supabase
    .from('exercises')
    .insert({ name: name.trim(), muscle_group: muscleGroup, user_id: userId, is_custom: true })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') throw new Error('You already have an exercise with that name.');
    throw error;
  }
  return data as Exercise;
}

const WORKOUT_SELECT =
  'id,name,started_at,completed_at,status,' +
  'workout_exercises(id,position,exercise_id,exercises(name),' +
  'workout_sets(id,exercise_id,set_order,weight,reps,completed))';

export async function fetchWorkouts(): Promise<WorkoutRow[]> {
  const { data, error } = await supabase
    .from('workouts')
    .select(WORKOUT_SELECT)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(300);
  if (error) throw error;
  return (data ?? []) as unknown as WorkoutRow[];
}

export async function fetchWorkout(id: string): Promise<WorkoutRow | null> {
  const { data, error } = await supabase.from('workouts').select(WORKOUT_SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return data as unknown as WorkoutRow | null;
}

/** Atomic save (create, or replace when draft.editingWorkoutId is set) via the save_workout RPC. */
export async function saveWorkout(draft: Draft, unit: Unit = 'lb'): Promise<string> {
  const exercises = draft.exercises
    .map((ex) => ({
      exercise_id: ex.exerciseId,
      sets: ex.sets
        .filter((s) => s.completed || num(s.reps) > 0 || num(s.weight) > 0)
        // Typed weights are in the user's display unit; the database always stores pounds.
        .map((s) => ({ weight: toLb(num(s.weight), unit), reps: Math.round(num(s.reps)), completed: s.completed })),
    }))
    .filter((ex) => ex.sets.length > 0);
  if (exercises.length === 0) throw new Error('Add at least one set before saving.');

  const { data, error } = await supabase.rpc('save_workout', {
    p_id: draft.editingWorkoutId ?? null,
    p_name: draft.name || null,
    p_started_at: draft.startedAt,
    p_completed_at: draft.completedAt ?? new Date().toISOString(),
    p_exercises: exercises,
  });
  if (error) throw error;
  return data as string;
}

export async function deleteWorkout(id: string): Promise<void> {
  const { error } = await supabase.from('workouts').delete().eq('id', id);
  if (error) throw error;
}

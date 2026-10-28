import { supabase } from '../lib/supabase';
import type { Exercise, LocalWorkout, WorkoutRow } from '../types';

export async function fetchExercises(): Promise<Exercise[]> {
  const { data, error } = await supabase.from('exercises').select('*').order('name');
  if (error) throw error;
  return data as Exercise[];
}

/** Create a custom exercise. `id` is supplied for exercises first created on the phone (so the id never changes). */
export async function createExercise(
  name: string,
  muscleGroup: string | null,
  userId: string,
  id?: string,
  repsOnly = false,
): Promise<Exercise> {
  const { data, error } = await supabase
    .from('exercises')
    .insert({
      ...(id ? { id } : {}),
      name: name.trim(),
      muscle_group: muscleGroup,
      user_id: userId,
      is_custom: true,
      reps_only: repsOnly,
    })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') throw Object.assign(new Error('You already have an exercise with that name.'), { code: '23505' });
    throw error;
  }
  return data as Exercise;
}

export async function findCustomExerciseByName(userId: string, name: string): Promise<Exercise | null> {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('user_id', userId)
    .ilike('name', name.trim())
    .maybeSingle();
  if (error) throw error;
  return data as Exercise | null;
}

const WORKOUT_SELECT =
  'id,name,started_at,completed_at,status,' +
  'workout_exercises(id,position,exercise_id,exercises(name,reps_only),' +
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

/**
 * Upload a workout. The phone-generated id is reused as the database id, and the save_workout function
 * replaces any existing workout with that id, so calling this twice for the same workout never duplicates it.
 */
export async function uploadWorkout(w: LocalWorkout): Promise<string> {
  const { data, error } = await supabase.rpc('save_workout', {
    p_id: w.id,
    p_name: w.name || null,
    p_started_at: w.startedAt,
    p_completed_at: w.completedAt,
    p_exercises: w.exercises.map((e) => ({ exercise_id: e.exerciseId, sets: e.sets })),
  });
  if (error) throw error;
  return data as string;
}

export async function deleteWorkout(id: string): Promise<void> {
  const { error } = await supabase.from('workouts').delete().eq('id', id);
  if (error) throw error;
}

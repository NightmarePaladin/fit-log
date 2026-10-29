import { supabase } from '../lib/supabase';

export type SharedWorkout = {
  name: string | null;
  completed_at: string | null;
  owner_name: string | null;
  exercises: { name: string; reps_only: boolean; timed?: boolean; sets: { weight: number; reps: number; completed: boolean }[] }[];
};

/** The existing share-link token for one of my workouts, if I have shared it. */
export async function getShareToken(workoutId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('workout_shares')
    .select('token')
    .eq('workout_id', workoutId)
    .maybeSingle();
  if (error) throw error;
  return data?.token ?? null;
}

/** Turn on (or reuse) the private share link for one of my workouts. The workout must already be uploaded. */
export async function getOrCreateShareToken(workoutId: string): Promise<string> {
  const existing = await getShareToken(workoutId);
  if (existing) return existing;
  const { data, error } = await supabase.from('workout_shares').insert({ workout_id: workoutId }).select('token').single();
  if (error) throw error;
  return data.token as string;
}

/** Turn the link off: it stops working immediately. */
export async function revokeShare(workoutId: string): Promise<void> {
  const { error } = await supabase.from('workout_shares').delete().eq('workout_id', workoutId);
  if (error) throw error;
}

/** Public: anyone with the token can read exactly this workout. Returns null for an unknown or revoked token. */
export async function fetchSharedWorkout(token: string): Promise<SharedWorkout | null> {
  const { data, error } = await supabase.rpc('get_shared_workout', { p_token: token });
  if (error) throw error;
  return (data as SharedWorkout | null) ?? null;
}

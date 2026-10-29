import { supabase } from '../lib/supabase';
import type { EditSet, WaltExercise, WaltMode, WaltSession, WaltSnapshot, WaltSet } from '../lib/walt';
import { toLb, type Unit } from '../lib/units';

/** Start a session. Returns its id and the 8-character code others join with. */
export async function createSession(name: string): Promise<{ id: string; code: string }> {
  const { data, error } = await supabase.rpc('create_walt_session', { p_name: name.trim() || null });
  if (error) throw error;
  return data as { id: string; code: string };
}

/** Join with a code. Returns the session id (also when you are already in it). */
export async function joinSession(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_walt_session', { p_code: code.trim() });
  if (error) throw error;
  return data as string;
}

export async function endSession(id: string): Promise<void> {
  const { error } = await supabase.rpc('end_walt_session', { p_id: id });
  if (error) throw error;
}

/** Leave a session you did not start (your sets in it are removed). */
export async function leaveSession(id: string): Promise<void> {
  const { error } = await supabase.rpc('leave_walt_session', { p_id: id });
  if (error) throw error;
}

/** Sessions I am in that are still running. Row-level security already limits this to my own. */
export async function listMySessions(): Promise<WaltSession[]> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from('walt_sessions')
    .select('id,code,host_id,name,status,created_at')
    .eq('status', 'active')
    .gt('created_at', since)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as WaltSession[];
}

const num = (v: unknown) => Number(v);

/** Everything about one session in one go: who is in it, the shared exercise list, and everyone's sets. */
export async function fetchSnapshot(id: string): Promise<WaltSnapshot> {
  const [s, m, e, st] = await Promise.all([
    supabase.from('walt_sessions').select('id,code,host_id,name,status,created_at').eq('id', id).single(),
    supabase.from('walt_members').select('user_id,display_name,finished_at').eq('session_id', id).order('joined_at'),
    supabase.from('walt_exercises').select('id,exercise_id,name,mode,position,added_by').eq('session_id', id).order('position'),
    supabase.from('walt_sets').select('id,walt_exercise_id,user_id,set_order,weight,reps,completed').eq('session_id', id),
  ]);
  for (const r of [s, m, e, st]) if (r.error) throw r.error;
  return {
    session: s.data as WaltSession,
    members: (m.data ?? []) as WaltSnapshot['members'],
    exercises: (e.data ?? []) as WaltExercise[],
    sets: ((st.data ?? []) as WaltSet[]).map((x) => ({ ...x, weight: num(x.weight) })),
  };
}

/** Add an exercise to the shared list. `exerciseId` is only sent for built-in exercises everyone can resolve. */
export async function addSessionExercise(
  sessionId: string,
  ex: { name: string; mode: WaltMode; exerciseId: string | null; position: number },
): Promise<void> {
  const { error } = await supabase
    .from('walt_exercises')
    .insert({ session_id: sessionId, name: ex.name, mode: ex.mode, exercise_id: ex.exerciseId, position: ex.position });
  if (error) throw error;
}

export async function removeSessionExercise(id: string): Promise<void> {
  const { error } = await supabase.from('walt_exercises').delete().eq('id', id);
  if (error) throw error;
}

/** Save my sets (new and changed ones). Weights are typed in my unit and stored in pounds. */
export async function upsertMySets(
  sessionId: string,
  userId: string,
  rows: { exerciseId: string; order: number; set: EditSet }[],
  unit: Unit,
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from('walt_sets').upsert(
    rows.map(({ exerciseId, order, set }) => ({
      id: set.id,
      walt_exercise_id: exerciseId,
      session_id: sessionId,
      user_id: userId,
      set_order: order,
      weight: set.weight === '' ? 0 : toLb(Number(set.weight) || 0, unit),
      reps: Math.max(0, Math.round(Number(set.reps) || 0)),
      completed: set.completed,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: 'id' },
  );
  if (error) throw error;
}

export async function deleteMySets(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from('walt_sets').delete().in('id', ids);
  if (error) throw error;
}

/** I have saved my workout to my own history. */
export async function markFinished(sessionId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('walt_members')
    .update({ finished_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .eq('user_id', userId);
  if (error) throw error;
}

/**
 * Call `onChange` whenever anything in the session changes (a set, an exercise, someone joining or leaving, the
 * session ending). Returns the function that stops listening. The caller also polls, so a dropped socket is harmless.
 */
export function subscribeToSession(id: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`walt:${id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'walt_sets', filter: `session_id=eq.${id}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'walt_exercises', filter: `session_id=eq.${id}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'walt_members', filter: `session_id=eq.${id}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'walt_sessions', filter: `id=eq.${id}` }, onChange)
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

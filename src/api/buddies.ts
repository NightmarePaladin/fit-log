import { supabase } from '../lib/supabase';
import { isNetworkError } from '../lib/net';
import type { WorkoutRow } from '../types';

export type Buddy = {
  id: string;
  name: string;
  /** they can see my workouts */
  iShareWithThem: boolean;
  /** I can see their workouts */
  theyShareWithMe: boolean;
};

export type Invite = { code: string; expires_at: string };

/** Turn a database/network error from the buddy functions into a sentence a person can act on. */
export function buddyErrorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
  if (isNetworkError(e)) return 'This needs an internet connection. Try again when you are online.';
  if (raw.includes('invalid_or_expired_code')) return 'That code is not valid or has expired. Ask your buddy for a new one.';
  if (raw.includes('own_code')) return 'That is your own code. Send it to your buddy instead.';
  if (raw.includes('too_many_active_invites')) return 'You already have 5 active invites. Cancel one or wait for it to expire.';
  if (raw.includes('not authenticated')) return 'Please sign in first.';
  return raw;
}

/** Everyone I am connected with, and in which direction we share. */
export async function listBuddies(myId: string): Promise<Buddy[]> {
  const { data, error } = await supabase.from('buddy_shares').select('owner_id,viewer_id');
  if (error) throw error;
  const map = new Map<string, { iShareWithThem: boolean; theyShareWithMe: boolean }>();
  for (const r of data ?? []) {
    const other = r.owner_id === myId ? r.viewer_id : r.owner_id;
    const cur = map.get(other) ?? { iShareWithThem: false, theyShareWithMe: false };
    if (r.owner_id === myId) cur.iShareWithThem = true;
    else cur.theyShareWithMe = true;
    map.set(other, cur);
  }
  if (map.size === 0) return [];
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('id,display_name').in('id', [...map.keys()]);
  if (pErr) throw pErr;
  const names = new Map((profiles ?? []).map((p) => [p.id as string, (p.display_name as string | null) ?? 'Buddy']));
  return [...map.entries()]
    .map(([id, dir]) => ({ id, name: names.get(id) ?? 'Buddy', ...dir }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function createInvite(): Promise<string> {
  const { data, error } = await supabase.rpc('create_buddy_invite');
  if (error) throw error;
  return data as string;
}

export async function listInvites(): Promise<Invite[]> {
  const { data, error } = await supabase
    .from('buddy_invites')
    .select('code,expires_at')
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Invite[];
}

export async function cancelInvite(code: string): Promise<void> {
  const { error } = await supabase.from('buddy_invites').delete().eq('code', code);
  if (error) throw error;
}

/** Enter a buddy's invite code. Both of you then see each other's workouts. Returns their user id. */
export async function acceptInvite(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_buddy_invite', { p_code: code.trim() });
  if (error) throw error;
  return data as string;
}

/** Stop my workouts being visible to this buddy (they keep sharing theirs unless they stop too). */
export async function stopSharingMine(myId: string, buddyId: string): Promise<void> {
  const { error } = await supabase.from('buddy_shares').delete().eq('owner_id', myId).eq('viewer_id', buddyId);
  if (error) throw error;
}

/** End the connection completely, both directions. */
export async function removeBuddy(myId: string, buddyId: string): Promise<void> {
  const { error } = await supabase
    .from('buddy_shares')
    .delete()
    .or(`and(owner_id.eq.${myId},viewer_id.eq.${buddyId}),and(owner_id.eq.${buddyId},viewer_id.eq.${myId})`);
  if (error) throw error;
}

const BUDDY_SELECT =
  'id,name,started_at,completed_at,status,' +
  'workout_exercises(id,position,exercise_id,exercises(name,reps_only),' +
  'workout_sets(id,exercise_id,set_order,weight,reps,completed))';

/** A buddy's recent workouts (read-only; allowed by the database only while they share with me). */
export async function fetchBuddyWorkouts(buddyId: string): Promise<WorkoutRow[]> {
  const { data, error } = await supabase
    .from('workouts')
    .select(BUDDY_SELECT)
    .eq('user_id', buddyId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(60);
  if (error) throw error;
  return (data ?? []) as unknown as WorkoutRow[];
}

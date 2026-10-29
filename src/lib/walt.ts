import type { Draft, Exercise } from '../types';
import { isNetworkError } from './net';
import { toDisplay, trimNum, type RepsMode, type Unit, type UnitFormat } from './units';

/**
 * W.A.L.T. (We All Lift Together): shared live workouts. These are the plain types and helpers; the database calls
 * live in src/api/walt.ts and the live state in src/hooks/useWaltSession.ts.
 */

export const MAX_MEMBERS = 4;

export type WaltMode = 'weight' | 'reps' | 'time';

export type WaltSession = {
  id: string;
  code: string;
  host_id: string;
  name: string;
  status: 'active' | 'ended';
  created_at: string;
};
export type WaltMember = { user_id: string; display_name: string; finished_at: string | null };
export type WaltExercise = {
  id: string;
  exercise_id: string | null;
  name: string;
  mode: WaltMode;
  position: number;
  added_by: string;
};
/** One set as stored on the server. Weight is pounds. */
export type WaltSet = {
  id: string;
  walt_exercise_id: string;
  user_id: string;
  set_order: number;
  weight: number;
  reps: number;
  completed: boolean;
};
export type WaltSnapshot = {
  session: WaltSession;
  members: WaltMember[];
  exercises: WaltExercise[];
  sets: WaltSet[];
};

/** A set I am editing on this device. Weight is typed in my own unit, so everything is a string. */
export type EditSet = { id: string; weight: string; reps: string; completed: boolean };

/** How the app's exercise flags map onto a W.A.L.T. mode. */
export const modeOfExercise = (ex: Pick<Exercise, 'reps_only' | 'timed'>): WaltMode =>
  ex.timed ? 'time' : ex.reps_only ? 'reps' : 'weight';

/** The same flag the rest of the app uses to format a set. */
export const repsModeOfWalt = (mode: WaltMode): RepsMode => (mode === 'time' ? 'time' : mode === 'reps');

/** What people actually type: upper-case letters and digits, at most 8. */
export const normalizeCode = (s: string): string => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

/** Turn a database/network error from the W.A.L.T. functions into a sentence a person can act on. */
export function waltErrorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
  if (isNetworkError(e)) return 'W.A.L.T. needs an internet connection. Try again when you are online.';
  if (raw.includes('invalid_or_expired_code')) return 'That code is not valid, or the session has ended. Ask for a new one.';
  if (raw.includes('session_full')) return 'That session is full (4 people).';
  if (raw.includes('too_many_active_sessions')) return 'You already have 3 active sessions. End one first.';
  if (raw.includes('host_must_end')) return 'You started this session, so you end it for everyone instead of leaving.';
  if (raw.includes('not_host_or_not_active')) return 'Only the person who started the session can end it.';
  if (raw.includes('not authenticated')) return 'Please sign in first.';
  return raw;
}

/** One person's sets for one exercise, in order. */
export const setsOf = (sets: WaltSet[], exerciseId: string, userId: string): WaltSet[] =>
  sets.filter((s) => s.walt_exercise_id === exerciseId && s.user_id === userId).sort((a, b) => a.set_order - b.set_order);

/** "135 × 10", "12 reps" or "21:00" for each set someone has logged. Unfinished sets are marked so they can look dim. */
export function describeWaltSets(sets: WaltSet[], mode: WaltMode, u: UnitFormat): { text: string; done: boolean }[] {
  return sets
    .filter((s) => s.reps > 0 || s.weight > 0)
    .map((s) => ({ text: u.setOrReps(Number(s.weight), s.reps, repsModeOfWalt(mode)), done: s.completed }));
}

/** Server rows → the editable form my own sets take on this device. */
export const toEditSets = (rows: WaltSet[], unit: Unit): EditSet[] =>
  rows.map((s) => ({
    id: s.id,
    weight: s.weight > 0 ? trimNum(toDisplay(Number(s.weight), unit)) : '',
    reps: s.reps > 0 ? String(s.reps) : '',
    completed: s.completed,
  }));

const blankSets = (mode: WaltMode, makeId: () => string): EditSet[] =>
  // a run or a plank is usually one long set; lifting usually three
  Array.from({ length: mode === 'time' ? 1 : 3 }, () => ({ id: makeId(), weight: '', reps: '', completed: false }));

/**
 * Bring my local, editable sets in line with a fresh server snapshot. What I am typing on this device is the truth
 * for my own sets, so existing entries are kept as they are. New exercises get blank rows (or my saved sets, if
 * I had some from before), and exercises that were removed are dropped.
 */
export function mergeMine(
  prev: Record<string, EditSet[]>,
  snap: Pick<WaltSnapshot, 'exercises' | 'sets'>,
  userId: string,
  unit: Unit,
  makeId: () => string,
): Record<string, EditSet[]> {
  const next: Record<string, EditSet[]> = {};
  for (const ex of snap.exercises) {
    if (prev[ex.id]) {
      next[ex.id] = prev[ex.id];
      continue;
    }
    const saved = setsOf(snap.sets, ex.id, userId);
    next[ex.id] = saved.length > 0 ? toEditSets(saved, unit) : blankSets(ex.mode, makeId);
  }
  return next;
}

/**
 * Turn my sets into a normal workout draft, so it is saved by the same code (and shows up in History, Progress,
 * sharing and exports) exactly like a workout I logged alone. `exerciseIds` maps each W.A.L.T. exercise to a real
 * exercise id in my own list. Exercises where I logged nothing are left out.
 */
export function buildWaltDraft(
  name: string,
  startedAt: string,
  exercises: WaltExercise[],
  mine: Record<string, EditSet[]>,
  exerciseIds: Map<string, string>,
): Draft {
  return {
    startedAt,
    name,
    exercises: [...exercises]
      .sort((a, b) => a.position - b.position)
      .map((ex) => ({
        key: ex.id,
        exerciseId: exerciseIds.get(ex.id) ?? '',
        name: ex.name,
        repsOnly: repsModeOfWalt(ex.mode),
        sets: (mine[ex.id] ?? [])
          .filter((s) => s.completed || Number(s.reps) > 0)
          .map((s) => ({ key: s.id, weight: ex.mode === 'weight' ? s.weight : '', reps: s.reps, completed: s.completed })),
      }))
      .filter((ex) => ex.sets.length > 0 && ex.exerciseId !== ''),
  };
}

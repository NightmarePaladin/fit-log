import { createExercise, fetchExercises } from '../api/workouts';
import { useLocalStore } from '../store/local';
import type { Exercise, LocalExercise } from '../types';
import { newId } from './id';
import { offlineExercises, visibleTo } from './localData';
import { isNetworkError } from './net';
import { hasLiveSession } from './session';

/**
 * The exercise list for the picker. Online it comes from the server (and is cached); with no connection or no
 * account it is the bundled library plus any custom exercises made on this phone.
 */
export async function loadExercises(userId: string | null): Promise<{ exercises: Exercise[]; offline: boolean }> {
  const store = useLocalStore.getState();
  if (userId) {
    try {
      if (!(await hasLiveSession())) throw new Error('offline');
      const all = await fetchExercises();
      store.setCache(userId, { customExercises: all.filter((e) => e.is_custom) });
      const known = new Set(all.map((e) => e.id));
      const waiting = visibleTo(store.customExercises, userId).filter((e) => !known.has(e.id));
      return { exercises: [...all, ...waiting].sort((a, b) => a.name.localeCompare(b.name)), offline: false };
    } catch (e) {
      if (!isNetworkError(e) && !(e instanceof Error && e.message === 'offline')) throw e;
    }
  }
  const cachedCustom = userId ? (store.cache[userId]?.customExercises ?? []) : [];
  return { exercises: offlineExercises(userId, cachedCustom, store.customExercises), offline: true };
}

/** Create a custom exercise: on the server when possible, otherwise on the phone to upload later. */
export async function createCustomExercise(
  name: string,
  userId: string | null,
  known: Exercise[],
  repsOnly = false,
): Promise<Exercise> {
  const clean = name.trim();
  if (!clean) throw new Error('Enter a name.');
  if (known.some((e) => e.name.toLowerCase() === clean.toLowerCase())) {
    throw new Error('An exercise with that name already exists.');
  }
  if (userId) {
    try {
      if (!(await hasLiveSession())) throw new Error('offline');
      return await createExercise(clean, null, userId, undefined, repsOnly);
    } catch (e) {
      if (!isNetworkError(e) && !(e instanceof Error && e.message === 'offline')) throw e;
    }
  }
  const local: LocalExercise = {
    id: newId(), user_id: userId, name: clean, muscle_group: null, is_custom: true, reps_only: repsOnly, ownerId: userId,
  };
  useLocalStore.getState().addCustomExercise(local);
  return local;
}

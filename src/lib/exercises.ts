import { createExercise, deleteExercise, fetchExercises } from '../api/workouts';
import { useLocalStore } from '../store/local';
import type { Exercise, LocalExercise } from '../types';
import { newId } from './id';
import { offlineExercises, visibleTo } from './localData';
import { isNetworkError } from './net';
import { hasLiveSession } from './session';

/**
 * The exercise list for the picker. Online it comes from the server (and is cached); with no connection or no
 * account it is the bundled library plus any custom exercises made on this device.
 */
export async function loadExercises(userId: string | null): Promise<{ exercises: Exercise[]; offline: boolean }> {
  const store = useLocalStore.getState();
  if (userId) {
    try {
      if (!(await hasLiveSession())) throw new Error('offline');
      const all = await fetchExercises(userId);
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

/**
 * Delete a custom exercise the user no longer wants. One made on this device and not uploaded yet is just removed
 * from the device; one on the server needs a connection. Either way it is refused while a workout still uses it.
 */
export async function deleteCustomExercise(ex: Exercise, userId: string | null): Promise<void> {
  const store = useLocalStore.getState();
  const waiting = store.workouts.some((w) => w.exercises.some((e) => e.exerciseId === ex.id));
  if (waiting) throw new Error('This exercise is used in a workout waiting to upload, so it can’t be deleted yet.');

  const onDevice = store.customExercises.some((e) => e.id === ex.id);
  if (onDevice) {
    store.removeCustomExercise(ex.id);
    return;
  }
  if (!userId) throw new Error('Sign in to delete this exercise.');
  try {
    if (!(await hasLiveSession())) throw new Error('offline');
    await deleteExercise(ex.id, userId);
  } catch (e) {
    if (isNetworkError(e) || (e instanceof Error && e.message === 'offline')) {
      throw new Error('You’re offline. Connect to the internet to delete this exercise.');
    }
    throw e;
  }
  const cached = store.cache[userId]?.customExercises;
  if (cached) store.setCache(userId, { customExercises: cached.filter((c) => c.id !== ex.id) });
}

/** Create a custom exercise: on the server when possible, otherwise on the device to upload later. */
export async function createCustomExercise(
  name: string,
  userId: string | null,
  known: Exercise[],
  repsOnly: boolean | 'time' = false,
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
    id: newId(), user_id: userId, name: clean, muscle_group: null, is_custom: true,
    reps_only: !!repsOnly, timed: repsOnly === 'time', ownerId: userId,
  };
  useLocalStore.getState().addCustomExercise(local);
  return local;
}

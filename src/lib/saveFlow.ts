import { createExercise, findCustomExerciseByName, uploadWorkout } from '../api/workouts';
import { useLocalStore } from '../store/local';
import type { Draft } from '../types';
import { newId } from './id';
import { draftToLocal, remapExercises } from './localData';
import { isNetworkError } from './net';
import { hasLiveSession } from './session';
import type { Unit } from './units';

export type FinishResult = { id: string; status: 'synced' | 'queued' };

/**
 * Upload this user's custom exercises that were created offline. Returns a map of old id -> id on the server
 * for the rare case the same exercise name already existed there (so workouts can be repointed).
 */
async function uploadCustomExercises(userId: string, only?: Set<string>): Promise<Map<string, string>> {
  const store = useLocalStore.getState();
  const remap = new Map<string, string>();
  for (const ex of store.customExercises.filter((e) => e.ownerId === userId && (!only || only.has(e.id)))) {
    try {
      await createExercise(ex.name, ex.muscle_group, userId, ex.id, !!ex.reps_only);
    } catch (e) {
      if ((e as { code?: string }).code !== '23505') throw e;
      // Same name already exists on the server (or this exact id was uploaded before).
      const existing = await findCustomExerciseByName(userId, ex.name);
      if (existing && existing.id !== ex.id) remap.set(ex.id, existing.id);
    }
    store.removeCustomExercise(ex.id);
  }
  return remap;
}

/**
 * Finish a workout. Signed-in and online: upload now. Otherwise (no connection, or no account) keep it on the
 * phone and mark it waiting. Real server errors (not connectivity) are thrown so the draft is kept and the user sees them.
 */
export async function finishWorkout(draft: Draft, unit: Unit, userId: string | null): Promise<FinishResult> {
  const id = draft.editingWorkoutId ?? newId();
  const local = draftToLocal(draft, unit, id, userId);
  const store = useLocalStore.getState();

  if (!userId) {
    store.addWorkout(local);
    return { id, status: 'queued' };
  }

  try {
    if (!(await hasLiveSession())) throw new Error('offline');
    const used = new Set(local.exercises.map((e) => e.exerciseId));
    const remap = await uploadCustomExercises(userId, used);
    await uploadWorkout(remapExercises(local, remap));
    store.removeWorkout(id); // clears an older queued copy if this was an edit
    return { id, status: 'synced' };
  } catch (e) {
    if (isNetworkError(e) || (e instanceof Error && e.message === 'offline')) {
      store.addWorkout(local);
      return { id, status: 'queued' };
    }
    throw e;
  }
}

let running: Promise<SyncResult> | null = null;
export type SyncResult = { uploaded: number; failed: number; offline: boolean };

/** Upload everything waiting on this phone that belongs to `userId`. Safe to call repeatedly. */
export function uploadPending(userId: string): Promise<SyncResult> {
  if (running) return running;
  running = (async (): Promise<SyncResult> => {
    const store = useLocalStore.getState();
    let uploaded = 0;
    let failed = 0;
    try {
      if (!(await hasLiveSession())) return { uploaded, failed, offline: true };
      const remap = await uploadCustomExercises(userId);
      for (const w of store.workouts.filter((x) => x.ownerId === userId)) {
        try {
          await uploadWorkout(remapExercises(w, remap));
          store.removeWorkout(w.id);
          uploaded++;
        } catch (e) {
          if (isNetworkError(e)) return { uploaded, failed, offline: true };
          store.setWorkoutError(w.id, e instanceof Error ? e.message : String((e as { message?: string }).message));
          failed++;
        }
      }
      return { uploaded, failed, offline: false };
    } catch (e) {
      if (isNetworkError(e)) return { uploaded, failed, offline: true };
      throw e;
    }
  })().finally(() => {
    running = null;
  });
  return running;
}

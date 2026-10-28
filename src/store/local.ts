import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Exercise, LocalExercise, LocalWorkout, WorkoutRow } from '../types';
import type { Unit } from '../lib/units';

export const GUEST = 'guest'; // draft owner id used in offline (no account) mode
const CACHE_LIMIT = 150;

type UserCache = {
  workouts?: WorkoutRow[];
  customExercises?: Exercise[];
  profile?: { name: string | null; unit: Unit };
};

type LocalState = {
  /** Workouts saved on this phone and not uploaded yet (guest-made and signed-in-while-offline). */
  workouts: LocalWorkout[];
  /** Custom exercises created offline, not uploaded yet. */
  customExercises: LocalExercise[];
  /** Last good copy of each signed-in user's server data, for offline reading. Keyed by user id. */
  cache: Record<string, UserCache>;
  /** True after the user taps "Access while offline" on the login screen. */
  offlineMode: boolean;
  /** Weight unit for offline (no account) mode. */
  guestUnit: Unit;

  addWorkout: (w: LocalWorkout) => void;
  removeWorkout: (id: string) => void;
  setWorkoutError: (id: string, error: string | undefined) => void;
  addCustomExercise: (e: LocalExercise) => void;
  removeCustomExercise: (id: string) => void;
  /** Give workouts/exercises made in offline mode to this account (after the user agrees to upload). */
  claimGuest: (userId: string) => void;
  /** Delete everything made in offline mode that has not been uploaded. */
  discardGuest: () => void;
  setCache: (userId: string, patch: UserCache) => void;
  /** Forget a user's cached server data (on sign out). Unuploaded workouts are kept. */
  clearCache: (userId: string) => void;
  /** Remove everything belonging to a user (after the account is deleted). */
  purgeUser: (userId: string) => void;
  setOfflineMode: (on: boolean) => void;
  setGuestUnit: (unit: Unit) => void;
};

export const useLocalStore = create<LocalState>()(
  persist(
    (set) => ({
      workouts: [],
      customExercises: [],
      cache: {},
      offlineMode: false,
      guestUnit: 'lb',

      addWorkout: (w) =>
        set((s) => ({ workouts: [...s.workouts.filter((x) => x.id !== w.id), { ...w, error: undefined }] })),
      removeWorkout: (id) => set((s) => ({ workouts: s.workouts.filter((w) => w.id !== id) })),
      setWorkoutError: (id, error) =>
        set((s) => ({ workouts: s.workouts.map((w) => (w.id === id ? { ...w, error } : w)) })),
      addCustomExercise: (e) =>
        set((s) => ({ customExercises: [...s.customExercises.filter((x) => x.id !== e.id), e] })),
      removeCustomExercise: (id) => set((s) => ({ customExercises: s.customExercises.filter((e) => e.id !== id) })),

      claimGuest: (userId) =>
        set((s) => ({
          workouts: s.workouts.map((w) => (w.ownerId === null ? { ...w, ownerId: userId } : w)),
          customExercises: s.customExercises.map((e) =>
            e.ownerId === null ? { ...e, ownerId: userId, user_id: userId } : e,
          ),
        })),
      discardGuest: () =>
        set((s) => ({
          workouts: s.workouts.filter((w) => w.ownerId !== null),
          customExercises: s.customExercises.filter((e) => e.ownerId !== null),
        })),

      setCache: (userId, patch) =>
        set((s) => {
          const next = { ...s.cache[userId], ...patch };
          if (next.workouts) next.workouts = next.workouts.slice(0, CACHE_LIMIT);
          return { cache: { ...s.cache, [userId]: next } };
        }),
      clearCache: (userId) =>
        set((s) => {
          const rest = { ...s.cache };
          delete rest[userId];
          return { cache: rest };
        }),
      purgeUser: (userId) =>
        set((s) => {
          const rest = { ...s.cache };
          delete rest[userId];
          return {
            cache: rest,
            workouts: s.workouts.filter((w) => w.ownerId !== userId),
            customExercises: s.customExercises.filter((e) => e.ownerId !== userId),
          };
        }),
      setOfflineMode: (on) => set({ offlineMode: on }),
      setGuestUnit: (unit) => set({ guestUnit: unit }),
    }),
    {
      name: 'fitlog:local',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/** True once the on-device store has been read from storage (needed before deciding which screen to show). */
export function useLocalHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useLocalStore.persist.onFinishHydration(onChange),
    () => useLocalStore.persist.hasHydrated(),
    () => false,
  );
}

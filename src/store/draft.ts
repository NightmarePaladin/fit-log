import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { uid } from '../lib/history';
import { convertWeightString, type Unit } from '../lib/units';
import type { Draft, DraftExercise, DraftSet } from '../types';

type DraftState = {
  /** user the draft belongs to, so a different account never sees it */
  ownerId: string | null;
  draft: Draft | null;
  start: (ownerId: string, exercises?: DraftExercise[], extra?: Partial<Draft>) => void;
  discard: () => void;
  setName: (name: string) => void;
  addExercise: (exerciseId: string, name: string, setCount?: number, repsOnly?: boolean) => void;
  removeExercise: (key: string) => void;
  addSet: (exKey: string) => void;
  removeSet: (exKey: string, setKey: string) => void;
  updateSet: (exKey: string, setKey: string, patch: Partial<DraftSet>) => void;
  /** Re-express every typed weight when the display unit changes mid-workout. */
  convertWeights: (from: Unit, to: Unit) => void;
};

const blankSet = (from?: DraftSet): DraftSet => ({
  key: uid(),
  weight: from?.weight ?? '',
  reps: from?.reps ?? '',
  completed: false,
});

const mapEx = (d: Draft, key: string, fn: (e: DraftExercise) => DraftExercise): Draft => ({
  ...d,
  exercises: d.exercises.map((e) => (e.key === key ? fn(e) : e)),
});

export const useDraftStore = create<DraftState>()(
  persist(
    (set, get) => ({
      ownerId: null,
      draft: null,
      start: (ownerId, exercises = [], extra = {}) =>
        set({
          ownerId,
          draft: { startedAt: new Date().toISOString(), name: '', exercises, ...extra },
        }),
      discard: () => set({ draft: null }),
      setName: (name) => {
        const d = get().draft;
        if (d) set({ draft: { ...d, name } });
      },
      convertWeights: (from, to) => {
        const d = get().draft;
        if (!d || from === to) return;
        set({
          draft: {
            ...d,
            exercises: d.exercises.map((e) => ({
              ...e,
              sets: e.sets.map((s) => ({ ...s, weight: convertWeightString(s.weight, from, to) })),
            })),
          },
        });
      },
      addExercise: (exerciseId, name, setCount = 3, repsOnly = false) => {
        const d = get().draft;
        if (!d) return;
        const ex: DraftExercise = {
          key: uid(),
          exerciseId,
          name,
          repsOnly,
          sets: Array.from({ length: Math.max(1, setCount) }, () => blankSet()),
        };
        set({ draft: { ...d, exercises: [...d.exercises, ex] } });
      },
      removeExercise: (key) => {
        const d = get().draft;
        if (d) set({ draft: { ...d, exercises: d.exercises.filter((e) => e.key !== key) } });
      },
      addSet: (exKey) => {
        const d = get().draft;
        // New sets start with the previous set's numbers: the common case is repeating a weight.
        if (d) set({ draft: mapEx(d, exKey, (e) => ({ ...e, sets: [...e.sets, blankSet(e.sets[e.sets.length - 1])] })) });
      },
      removeSet: (exKey, setKey) => {
        const d = get().draft;
        if (d) set({ draft: mapEx(d, exKey, (e) => ({ ...e, sets: e.sets.filter((s) => s.key !== setKey) })) });
      },
      updateSet: (exKey, setKey, patch) => {
        const d = get().draft;
        if (d)
          set({
            draft: mapEx(d, exKey, (e) => ({
              ...e,
              sets: e.sets.map((s) => (s.key === setKey ? { ...s, ...patch } : s)),
            })),
          });
      },
    }),
    {
      name: 'fitlog:draft',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ ownerId: s.ownerId, draft: s.draft }),
    },
  ),
);

export function useHasHydrated() {
  return useSyncExternalStore(
    (onChange) => useDraftStore.persist.onFinishHydration(onChange),
    () => useDraftStore.persist.hasHydrated(),
    () => false,
  );
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { LIBRARY } from '../src/data/library';
import { exerciseRepsOnly, workoutToDraftExercises, workoutTotals } from '../src/lib/history';
import { draftToLocal, localToRow } from '../src/lib/localData';
import { makeUnitFormat } from '../src/lib/units';
import type { Draft } from '../src/types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../src/lib/id', () => ({ newId: () => 'local-id-1' }));
jest.mock('../src/lib/session', () => ({ hasLiveSession: jest.fn() }));
jest.mock('../src/api/workouts', () => ({
  createExercise: jest.fn(),
  fetchExercises: jest.fn(),
  uploadWorkout: jest.fn(),
  findCustomExerciseByName: jest.fn(),
}));

import * as api from '../src/api/workouts';
import { createCustomExercise } from '../src/lib/exercises';
import { uploadPending } from '../src/lib/saveFlow';
import { hasLiveSession } from '../src/lib/session';
import { useDraftStore } from '../src/store/draft';
import { useLocalStore } from '../src/store/local';

const draftWith = (repsOnly: boolean): Draft => ({
  startedAt: '2026-10-28T10:00:00.000Z',
  name: '',
  exercises: [
    {
      key: 'k', exerciseId: 'pushup', name: 'Push-Up', repsOnly,
      sets: [{ key: 's', weight: '', reps: '15', completed: true }],
    },
  ],
});

describe('reps-only exercises', () => {
  it('the built-in bodyweight exercises are flagged, the rest are not', () => {
    const flagged = LIBRARY.filter((e) => e.reps_only).map((e) => e.name).sort();
    expect(flagged).toEqual(['Dip', 'Hanging Leg Raise', 'Pull-Up', 'Push-Up']);
    expect(LIBRARY.find((e) => e.name === 'Barbell Squat')?.reps_only).toBe(false);
  });

  it('a reps-only set saves with weight 0 and keeps the flag', () => {
    const w = draftToLocal(draftWith(true), 'lb', 'w1', 'u1');
    expect(w.exercises[0]).toMatchObject({ repsOnly: true });
    expect(w.exercises[0].sets).toEqual([{ weight: 0, reps: 15, completed: true }]);
    expect(localToRow(w).workout_exercises[0].exercises?.reps_only).toBe(true);
  });

  it('copying a saved reps-only workout keeps it reps-only, and totals fall back to reps', () => {
    const row = localToRow(draftToLocal(draftWith(true), 'lb', 'w1', null));
    expect(workoutToDraftExercises(row)[0].repsOnly).toBe(true);
    expect(exerciseRepsOnly([row]).has('pushup')).toBe(true);
    expect(workoutTotals(row)).toEqual({ volume: 0, sets: 1, reps: 15 });
  });

  it('formats "12 reps" for reps-only sets and normal sets otherwise', () => {
    const lb = makeUnitFormat('lb');
    expect(lb.setOrReps(0, 12, true)).toBe('12 reps');
    expect(lb.setOrReps(135, 10, false)).toBe('135 × 10');
    expect(lb.setOrReps(25, 8, true)).toBe('25 × 8'); // a weighted set of a bodyweight exercise still shows its weight
  });

  it('the draft store remembers repsOnly for an added exercise', () => {
    useDraftStore.setState({ ownerId: null, draft: null });
    useDraftStore.getState().start('u1');
    useDraftStore.getState().addExercise('e1', 'Pull-Up', 3, true);
    useDraftStore.getState().addExercise('e2', 'Bench', 3);
    const ex = useDraftStore.getState().draft!.exercises;
    expect(ex[0].repsOnly).toBe(true);
    expect(ex[1].repsOnly).toBe(false);
  });
});

describe('creating a custom exercise', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useLocalStore.setState({ workouts: [], customExercises: [], cache: {}, offlineMode: false });
    jest.resetAllMocks();
  });

  it('offline: stored on the phone with the chosen type, then uploaded with that type', async () => {
    (hasLiveSession as jest.Mock).mockResolvedValue(false);
    const ex = await createCustomExercise('Ring Dip', 'u1', LIBRARY, true);
    expect(ex).toMatchObject({ id: 'local-id-1', name: 'Ring Dip', reps_only: true, is_custom: true });
    expect(useLocalStore.getState().customExercises[0].reps_only).toBe(true);

    (hasLiveSession as jest.Mock).mockResolvedValue(true);
    (api.createExercise as jest.Mock).mockResolvedValue({});
    await uploadPending('u1');
    expect(api.createExercise).toHaveBeenCalledWith('Ring Dip', null, 'u1', 'local-id-1', true);
  });

  it('online: sends the type to the server', async () => {
    (hasLiveSession as jest.Mock).mockResolvedValue(true);
    (api.createExercise as jest.Mock).mockResolvedValue({ id: 'srv', name: 'Cable Fly', reps_only: false });
    await createCustomExercise('Cable Fly', 'u1', LIBRARY, false);
    expect(api.createExercise).toHaveBeenCalledWith('Cable Fly', null, 'u1', undefined, false);
  });

  it('rejects a blank name and a duplicate of an existing exercise', async () => {
    await expect(createCustomExercise('   ', 'u1', LIBRARY)).rejects.toThrow(/name/i);
    await expect(createCustomExercise('push-up', 'u1', LIBRARY)).rejects.toThrow(/already exists/);
  });
});

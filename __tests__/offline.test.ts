import AsyncStorage from '@react-native-async-storage/async-storage';
import { isNetworkError } from '../src/lib/net';
import { draftToLocal, localToRow, mergeWorkouts, offlineExercises, remapExercises, visibleTo } from '../src/lib/localData';
import { flattenWorkouts, previousByExercise } from '../src/lib/history';
import { LIBRARY } from '../src/data/library';
import type { Draft, LocalExercise, LocalWorkout, WorkoutRow } from '../src/types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const draft = (overrides: Partial<Draft> = {}): Draft => ({
  startedAt: '2026-10-28T10:00:00.000Z',
  name: 'Gym',
  exercises: [
    {
      key: 'k1',
      exerciseId: 'ex-bench',
      name: 'Barbell Bench Press',
      sets: [
        { key: 's1', weight: '135', reps: '10', completed: true },
        { key: 's2', weight: '', reps: '', completed: false }, // empty row is dropped
      ],
    },
  ],
  ...overrides,
});

describe('isNetworkError', () => {
  it('recognises connectivity failures but not server rejections', () => {
    expect(isNetworkError(new TypeError('Network request failed'))).toBe(true);
    expect(isNetworkError({ message: 'TypeError: Failed to fetch' })).toBe(true);
    expect(isNetworkError(Object.assign(new Error('x'), { name: 'AuthRetryableFetchError' }))).toBe(true);
    expect(isNetworkError(new Error('The request timed out'))).toBe(true);
    expect(isNetworkError({ message: 'new row violates row-level security policy', code: '42501' })).toBe(false);
    expect(isNetworkError(new Error('workout not found'))).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});

describe('draftToLocal', () => {
  it('keeps used sets, converts the display unit to lb, and tags the owner', () => {
    const w = draftToLocal(draft(), 'lb', 'w1', 'u1');
    expect(w).toMatchObject({ id: 'w1', ownerId: 'u1', name: 'Gym' });
    expect(w.exercises[0].sets).toEqual([{ weight: 135, reps: 10, completed: true }]);
    const kg = draftToLocal(draft({ exercises: [{ ...draft().exercises[0], sets: [{ key: 's', weight: '100', reps: '5', completed: true }] }] }), 'kg', 'w2', null);
    expect(kg.exercises[0].sets[0].weight).toBeCloseTo(220.4623, 3);
    expect(kg.ownerId).toBeNull();
  });
  it('refuses a workout with no sets', () => {
    const empty = draft({ exercises: [{ ...draft().exercises[0], sets: [{ key: 's', weight: '', reps: '', completed: false }] }] });
    expect(() => draftToLocal(empty, 'lb', 'w', 'u')).toThrow(/at least one set/);
  });
  it('preserves an original completion time when editing', () => {
    const w = draftToLocal(draft({ completedAt: '2026-10-20T09:00:00.000Z' }), 'lb', 'w', 'u');
    expect(w.completedAt).toBe('2026-10-20T09:00:00.000Z');
  });
});

describe('phone-stored workouts feed the normal screens', () => {
  const pending = draftToLocal(draft({ completedAt: '2026-10-28T11:00:00.000Z' }), 'lb', 'pending-1', 'u1');
  const serverRow: WorkoutRow = {
    id: 'server-1', name: 'Old', started_at: '2026-10-20T10:00:00Z', completed_at: '2026-10-20T11:00:00Z', status: 'completed',
    workout_exercises: [{ id: 'we', position: 1, exercise_id: 'ex-bench', exercises: { name: 'Barbell Bench Press' }, workout_sets: [{ id: 's', exercise_id: 'ex-bench', set_order: 1, weight: 125, reps: 8, completed: true }] }],
  };

  it('localToRow marks the workout pending and keeps the sets', () => {
    const row = localToRow(pending);
    expect(row.pending).toBe(true);
    expect(row.workout_exercises[0].workout_sets[0]).toMatchObject({ weight: 135, reps: 10, completed: true });
  });
  it('merge puts newest first and a phone copy replaces the server copy with the same id', () => {
    const edited = { ...pending, id: 'server-1' };
    const merged = mergeWorkouts([serverRow], [pending, edited]);
    expect(merged.map((w) => w.id).sort()).toEqual(['pending-1', 'server-1']);
    expect(merged[0].id).not.toBeUndefined();
    expect(merged.find((w) => w.id === 'server-1')?.pending).toBe(true);
    expect(mergeWorkouts([serverRow], [pending])[0].id).toBe('pending-1');
  });
  it('Last Workout and stats see offline workouts', () => {
    const merged = mergeWorkouts([serverRow], [pending]);
    expect(previousByExercise(merged).get('ex-bench')).toEqual([{ weight: 135, reps: 10 }]);
    expect(flattenWorkouts(merged)).toHaveLength(2);
  });
});

describe('visibility rules (privacy)', () => {
  const items = [{ ownerId: 'u1', n: 1 }, { ownerId: 'u2', n: 2 }, { ownerId: null, n: 3 }];
  it('a signed-in user sees only their own; offline mode sees everything waiting on the phone', () => {
    expect(visibleTo(items, 'u1').map((i) => i.n)).toEqual([1]);
    expect(visibleTo(items, null).map((i) => i.n)).toEqual([1, 2, 3]);
  });
});

describe('offlineExercises', () => {
  const mine: LocalExercise = { id: 'c1', name: 'Cable Fly', muscle_group: null, user_id: 'u1', is_custom: true, ownerId: 'u1' };
  const theirs: LocalExercise = { ...mine, id: 'c2', name: 'Secret Lift', user_id: 'u2', ownerId: 'u2' };
  it('always includes the bundled library, so a fresh offline install works', () => {
    expect(LIBRARY.length).toBe(34);
    expect(offlineExercises(null).length).toBe(34);
    expect(offlineExercises('u1').some((e) => e.name === 'Barbell Squat')).toBe(true);
  });
  it('adds only the viewer’s own custom exercises', () => {
    const names = offlineExercises('u1', [], [mine, theirs]).map((e) => e.name);
    expect(names).toContain('Cable Fly');
    expect(names).not.toContain('Secret Lift');
  });
});

describe('remapExercises', () => {
  it('repoints exercise ids', () => {
    const w: LocalWorkout = draftToLocal(draft(), 'lb', 'w', 'u');
    expect(remapExercises(w, new Map([['ex-bench', 'server-bench']])).exercises[0].exerciseId).toBe('server-bench');
    expect(remapExercises(w, new Map())).toBe(w);
  });
});

describe('local store', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    const { useLocalStore } = require('../src/store/local');
    useLocalStore.setState({ workouts: [], customExercises: [], cache: {}, offlineMode: false });
  });

  it('claimGuest moves only guest items to the account; discardGuest removes only guest items', () => {
    const { useLocalStore } = require('../src/store/local');
    const s = useLocalStore.getState();
    s.addWorkout(draftToLocal(draft(), 'lb', 'g1', null));
    s.addWorkout(draftToLocal(draft(), 'lb', 'u1w', 'u1'));
    s.addCustomExercise({ id: 'c', name: 'X', muscle_group: null, user_id: null, is_custom: true, ownerId: null });
    useLocalStore.getState().claimGuest('u2');
    const ws = useLocalStore.getState().workouts;
    expect(ws.find((w: LocalWorkout) => w.id === 'g1')?.ownerId).toBe('u2');
    expect(ws.find((w: LocalWorkout) => w.id === 'u1w')?.ownerId).toBe('u1');
    expect(useLocalStore.getState().customExercises[0]).toMatchObject({ ownerId: 'u2', user_id: 'u2' });

    useLocalStore.setState({ workouts: [draftToLocal(draft(), 'lb', 'g2', null), draftToLocal(draft(), 'lb', 'k', 'u1')], customExercises: [] });
    useLocalStore.getState().discardGuest();
    expect(useLocalStore.getState().workouts.map((w: LocalWorkout) => w.id)).toEqual(['k']);
  });

  it('survives an app restart (rehydrates from storage)', async () => {
    const { useLocalStore } = require('../src/store/local');
    useLocalStore.getState().addWorkout(draftToLocal(draft(), 'lb', 'persist-me', null));
    useLocalStore.getState().setOfflineMode(true);
    await Promise.resolve();
    const onDisk = await AsyncStorage.getItem('fitlog:local');
    useLocalStore.setState({ workouts: [], offlineMode: false });
    await AsyncStorage.setItem('fitlog:local', onDisk!);
    await useLocalStore.persist.rehydrate();
    expect(useLocalStore.getState().workouts[0].id).toBe('persist-me');
    expect(useLocalStore.getState().offlineMode).toBe(true);
  });

  it('sign-out clears the cached server data but keeps un-uploaded workouts; purge removes everything for the user', () => {
    const { useLocalStore } = require('../src/store/local');
    const s = useLocalStore.getState();
    s.setCache('u1', { workouts: [] });
    s.addWorkout(draftToLocal(draft(), 'lb', 'w', 'u1'));
    useLocalStore.getState().clearCache('u1');
    expect(useLocalStore.getState().cache.u1).toBeUndefined();
    expect(useLocalStore.getState().workouts).toHaveLength(1);
    useLocalStore.getState().purgeUser('u1');
    expect(useLocalStore.getState().workouts).toHaveLength(0);
  });
});

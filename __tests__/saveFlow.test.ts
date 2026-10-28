import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Draft } from '../src/types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
let mockCounter = 0;
jest.mock('../src/lib/id', () => ({ newId: () => `new-id-${++mockCounter}` }));
jest.mock('../src/lib/session', () => ({ hasLiveSession: jest.fn() }));
jest.mock('../src/api/workouts', () => ({
  uploadWorkout: jest.fn(),
  createExercise: jest.fn(),
  findCustomExerciseByName: jest.fn(),
  fetchExercises: jest.fn(),
}));

import * as api from '../src/api/workouts';
import { hasLiveSession } from '../src/lib/session';
import { finishWorkout, uploadPending } from '../src/lib/saveFlow';
import { useLocalStore } from '../src/store/local';

const upload = api.uploadWorkout as jest.Mock;
const createEx = api.createExercise as jest.Mock;
const findEx = api.findCustomExerciseByName as jest.Mock;
const live = hasLiveSession as jest.Mock;

const draft: Draft = {
  startedAt: '2026-10-28T10:00:00.000Z',
  name: 'Gym',
  exercises: [{ key: 'k', exerciseId: 'ex1', name: 'Bench', sets: [{ key: 's', weight: '135', reps: '10', completed: true }] }],
};

beforeEach(async () => {
  await AsyncStorage.clear();
  useLocalStore.setState({ workouts: [], customExercises: [], cache: {}, offlineMode: false });
  jest.resetAllMocks();
  live.mockResolvedValue(true);
});

describe('finishWorkout', () => {
  it('online + signed in: uploads with the phone-generated id and keeps nothing waiting', async () => {
    upload.mockResolvedValue('ok');
    const r = await finishWorkout(draft, 'lb', 'u1');
    expect(r.status).toBe('synced');
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0][0]).toMatchObject({ id: r.id, ownerId: 'u1' });
    expect(useLocalStore.getState().workouts).toHaveLength(0);
  });

  it('no connection: saves on the phone and reports queued (nothing lost)', async () => {
    upload.mockRejectedValue(new TypeError('Network request failed'));
    const r = await finishWorkout(draft, 'lb', 'u1');
    expect(r.status).toBe('queued');
    expect(useLocalStore.getState().workouts.map((w) => w.id)).toEqual([r.id]);
  });

  it('session cannot be refreshed (treated as offline): queues without calling the server', async () => {
    live.mockResolvedValue(false);
    const r = await finishWorkout(draft, 'lb', 'u1');
    expect(r.status).toBe('queued');
    expect(upload).not.toHaveBeenCalled();
  });

  it('guest (no account): always saves on the phone, owner null', async () => {
    const r = await finishWorkout(draft, 'lb', null);
    expect(r.status).toBe('queued');
    expect(upload).not.toHaveBeenCalled();
    expect(useLocalStore.getState().workouts[0].ownerId).toBeNull();
  });

  it('a real server rejection is thrown (draft is kept by the caller) and is NOT silently queued', async () => {
    upload.mockRejectedValue({ message: 'new row violates row-level security policy', code: '42501' });
    await expect(finishWorkout(draft, 'lb', 'u1')).rejects.toBeTruthy();
    expect(useLocalStore.getState().workouts).toHaveLength(0);
  });

  it('editing keeps the same id so the upload replaces instead of duplicating', async () => {
    upload.mockRejectedValue(new TypeError('Failed to fetch'));
    const r = await finishWorkout({ ...draft, editingWorkoutId: 'existing-id' }, 'lb', 'u1');
    expect(r.id).toBe('existing-id');
  });
});

describe('uploadPending', () => {
  const queue = async (ownerId: string | null, count = 1) => {
    for (let i = 0; i < count; i++) {
      upload.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      if (ownerId) await finishWorkout(draft, 'lb', ownerId);
      else await finishWorkout(draft, 'lb', null);
    }
    upload.mockReset();
  };

  it('uploads only the signed-in user’s own queued workouts and clears them', async () => {
    await queue('u1', 2);
    await queue(null, 1); // guest workout must NOT be uploaded without the user agreeing
    upload.mockResolvedValue('ok');
    const r = await uploadPending('u1');
    expect(r).toEqual({ uploaded: 2, failed: 0, offline: false });
    expect(useLocalStore.getState().workouts.map((w) => w.ownerId)).toEqual([null]);
  });

  it('after the user agrees, claimed guest workouts upload under their account', async () => {
    await queue(null, 2);
    useLocalStore.getState().claimGuest('u9');
    upload.mockResolvedValue('ok');
    const r = await uploadPending('u9');
    expect(r.uploaded).toBe(2);
    expect(upload.mock.calls.every(([w]) => w.ownerId === 'u9')).toBe(true);
    expect(useLocalStore.getState().workouts).toHaveLength(0);
  });

  it('stops quietly when the connection drops and keeps the remaining workouts', async () => {
    await queue('u1', 3);
    upload.mockResolvedValueOnce('ok').mockRejectedValue(new TypeError('Network request failed'));
    const r = await uploadPending('u1');
    expect(r).toEqual({ uploaded: 1, failed: 0, offline: true });
    expect(useLocalStore.getState().workouts).toHaveLength(2);
  });

  it('a workout the server rejects is kept with its error and does not block the others', async () => {
    await queue('u1', 2);
    upload.mockRejectedValueOnce({ message: 'bad data', code: '22P02' }).mockResolvedValue('ok');
    const r = await uploadPending('u1');
    expect(r).toEqual({ uploaded: 1, failed: 1, offline: false });
    const left = useLocalStore.getState().workouts;
    expect(left).toHaveLength(1);
    expect(left[0].error).toBe('bad data');
  });

  it('does nothing while there is no live session', async () => {
    await queue('u1', 1);
    live.mockResolvedValue(false);
    expect(await uploadPending('u1')).toEqual({ uploaded: 0, failed: 0, offline: true });
    expect(upload).not.toHaveBeenCalled();
  });

  it('uploads offline-made custom exercises first, using their phone-generated ids', async () => {
    useLocalStore.getState().addCustomExercise({ id: 'cx', name: 'Cable Fly', muscle_group: null, user_id: 'u1', is_custom: true, ownerId: 'u1' });
    createEx.mockResolvedValue({});
    await uploadPending('u1');
    expect(createEx).toHaveBeenCalledWith('Cable Fly', null, 'u1', 'cx');
    expect(useLocalStore.getState().customExercises).toHaveLength(0);
  });

  it('if the same exercise name already exists on the server, workouts are repointed to it', async () => {
    useLocalStore.getState().addCustomExercise({ id: 'cx', name: 'Cable Fly', muscle_group: null, user_id: 'u1', is_custom: true, ownerId: 'u1' });
    useLocalStore.getState().addWorkout({
      id: 'w', ownerId: 'u1', name: '', startedAt: 'a', completedAt: 'b',
      exercises: [{ exerciseId: 'cx', name: 'Cable Fly', sets: [{ weight: 1, reps: 1, completed: true }] }],
    });
    createEx.mockRejectedValue(Object.assign(new Error('dup'), { code: '23505' }));
    findEx.mockResolvedValue({ id: 'server-cx', name: 'Cable Fly' });
    upload.mockResolvedValue('ok');
    await uploadPending('u1');
    expect(upload.mock.calls[0][0].exercises[0].exerciseId).toBe('server-cx');
  });
});

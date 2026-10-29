import type { Exercise, LocalExercise, LocalWorkout } from '../src/types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../src/lib/session', () => ({ hasLiveSession: jest.fn() }));
jest.mock('../src/api/workouts', () => ({
  createExercise: jest.fn(),
  fetchExercises: jest.fn(),
  deleteExercise: jest.fn(),
  uploadWorkout: jest.fn(),
  findCustomExerciseByName: jest.fn(),
}));

import * as api from '../src/api/workouts';
import { deleteCustomExercise } from '../src/lib/exercises';
import { hasLiveSession } from '../src/lib/session';
import { useLocalStore } from '../src/store/local';

const ex = (id: string): Exercise => ({ id, user_id: 'u1', name: `Ex ${id}`, muscle_group: null, is_custom: true });
const waitingWorkout = (exerciseId: string): LocalWorkout => ({
  id: 'w1', ownerId: 'u1', name: '', startedAt: '2026-10-29T10:00:00Z', completedAt: '2026-10-29T11:00:00Z',
  exercises: [{ exerciseId, name: 'x', sets: [{ weight: 0, reps: 5, completed: true }] }],
});

beforeEach(() => {
  jest.clearAllMocks();
  useLocalStore.setState({ workouts: [], customExercises: [], cache: {} });
  (hasLiveSession as jest.Mock).mockResolvedValue(true);
});

describe('deleting a custom exercise', () => {
  it('removes one made on this device without needing a connection', async () => {
    const local: LocalExercise = { ...ex('a'), ownerId: 'u1' };
    useLocalStore.setState({ customExercises: [local] });
    (hasLiveSession as jest.Mock).mockResolvedValue(false);
    await deleteCustomExercise(ex('a'), 'u1');
    expect(useLocalStore.getState().customExercises).toEqual([]);
    expect(api.deleteExercise).not.toHaveBeenCalled();
  });

  it('refuses while a workout waiting to upload uses it', async () => {
    useLocalStore.setState({ workouts: [waitingWorkout('a')] });
    await expect(deleteCustomExercise(ex('a'), 'u1')).rejects.toThrow(/waiting to upload/);
    expect(api.deleteExercise).not.toHaveBeenCalled();
  });

  it('deletes a server exercise and drops it from the cached list', async () => {
    useLocalStore.setState({ cache: { u1: { customExercises: [ex('a'), ex('b')] } } });
    (api.deleteExercise as jest.Mock).mockResolvedValue(undefined);
    await deleteCustomExercise(ex('a'), 'u1');
    expect(api.deleteExercise).toHaveBeenCalledWith('a', 'u1');
    expect(useLocalStore.getState().cache.u1.customExercises?.map((e) => e.id)).toEqual(['b']);
  });

  it('says so when offline and leaves the exercise alone', async () => {
    (hasLiveSession as jest.Mock).mockResolvedValue(false);
    await expect(deleteCustomExercise(ex('a'), 'u1')).rejects.toThrow(/offline/i);
    expect(api.deleteExercise).not.toHaveBeenCalled();
  });

  it('passes through the "used in your history" error from the server', async () => {
    (api.deleteExercise as jest.Mock).mockRejectedValue(new Error('This exercise is in your workout history'));
    await expect(deleteCustomExercise(ex('a'), 'u1')).rejects.toThrow(/workout history/);
  });

  it('needs an account for a server exercise', async () => {
    await expect(deleteCustomExercise(ex('a'), null)).rejects.toThrow(/Sign in/);
  });
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDraftStore } from '../src/store/draft';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('workout draft persistence', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useDraftStore.setState({ ownerId: null, draft: null });
  });

  it('adds exercises/sets and logs them to storage', async () => {
    const s = useDraftStore.getState();
    s.start('user-1');
    s.addExercise('ex-1', 'Barbell Squat', 3);
    const exKey = useDraftStore.getState().draft!.exercises[0].key;
    const setKey = useDraftStore.getState().draft!.exercises[0].sets[0].key;
    s.updateSet(exKey, setKey, { weight: '225', reps: '10', completed: true });

    const raw = await AsyncStorage.getItem('fitlog:draft');
    expect(raw).toContain('Barbell Squat');
    expect(raw).toContain('225');
  });

  it('restores an unfinished workout after a "restart" (rehydrate from storage)', async () => {
    const s = useDraftStore.getState();
    s.start('user-1');
    s.addExercise('ex-1', 'Barbell Squat', 2);
    const exKey = useDraftStore.getState().draft!.exercises[0].key;
    const setKey = useDraftStore.getState().draft!.exercises[0].sets[1].key;
    s.updateSet(exKey, setKey, { weight: '135', reps: '8' });
    await Promise.resolve();
    const onDisk = await AsyncStorage.getItem('fitlog:draft');

    // Simulate a fresh process: memory is empty, only what was on disk survives.
    useDraftStore.setState({ ownerId: null, draft: null });
    await AsyncStorage.setItem('fitlog:draft', onDisk!);
    await useDraftStore.persist.rehydrate();

    const d = useDraftStore.getState();
    expect(d.ownerId).toBe('user-1');
    expect(d.draft?.exercises[0].name).toBe('Barbell Squat');
    expect(d.draft?.exercises[0].sets[1]).toMatchObject({ weight: '135', reps: '8' });
  });

  it('new sets copy the previous set values, remove works, discard clears', () => {
    const s = useDraftStore.getState();
    s.start('user-1');
    s.addExercise('ex-1', 'Bench', 1);
    let ex = useDraftStore.getState().draft!.exercises[0];
    s.updateSet(ex.key, ex.sets[0].key, { weight: '155', reps: '8', completed: true });
    s.addSet(ex.key);
    ex = useDraftStore.getState().draft!.exercises[0];
    expect(ex.sets).toHaveLength(2);
    expect(ex.sets[1]).toMatchObject({ weight: '155', reps: '8', completed: false });
    s.removeSet(ex.key, ex.sets[1].key);
    expect(useDraftStore.getState().draft!.exercises[0].sets).toHaveLength(1);
    s.discard();
    expect(useDraftStore.getState().draft).toBeNull();
  });
});

import { draftToLocal, localToRow } from '../src/lib/localData';
import { workoutTotals } from '../src/lib/history';
import { makeUnitFormat } from '../src/lib/units';
import {
  buildWaltDraft, describeWaltSets, isSignedOutError, mergeMine, modeOfExercise, normalizeCode, repsModeOfWalt, setsOf, toEditSets,
  waltErrorMessage, type EditSet, type WaltExercise, type WaltSet,
} from '../src/lib/walt';

const lb = makeUnitFormat('lb');
const kg = makeUnitFormat('kg');

const ex = (id: string, mode: WaltExercise['mode'], position = 0, exercise_id: string | null = null): WaltExercise => ({
  id, exercise_id, name: `Ex ${id}`, mode, position, added_by: 'host',
});
const set = (id: string, exId: string, user: string, order: number, weight: number, reps: number, completed = true): WaltSet => ({
  id, walt_exercise_id: exId, user_id: user, set_order: order, weight, reps, completed,
});

let n = 0;
const makeId = () => `new-${++n}`;

describe('W.A.L.T. helpers', () => {
  it('cleans up a typed code', () => {
    expect(normalizeCode(' ab-c2 d3ef9z ')).toBe('ABC2D3EF');
    expect(normalizeCode('xyz')).toBe('XYZ');
  });

  it('maps exercise flags to a mode and back to the formatting flag', () => {
    expect(modeOfExercise({ reps_only: true, timed: true })).toBe('time');
    expect(modeOfExercise({ reps_only: true })).toBe('reps');
    expect(modeOfExercise({})).toBe('weight');
    expect(repsModeOfWalt('time')).toBe('time');
    expect(repsModeOfWalt('reps')).toBe(true);
    expect(repsModeOfWalt('weight')).toBe(false);
  });

  it('turns errors into plain sentences', () => {
    expect(waltErrorMessage(new Error('invalid_or_expired_code'))).toMatch(/not valid|ended/);
    expect(waltErrorMessage({ message: 'session_full' })).toMatch(/full/);
    expect(waltErrorMessage(new Error('too_many_active_sessions'))).toMatch(/3 active/);
    expect(waltErrorMessage(new Error('host_must_end'))).toMatch(/end it/);
    expect(waltErrorMessage(new Error('something odd'))).toBe('something odd');
  });

  it('lists one person\'s sets in order, and only theirs', () => {
    const sets = [set('c', 'e1', 'me', 2, 100, 5), set('a', 'e1', 'me', 1, 90, 8), set('x', 'e1', 'pal', 1, 50, 5), set('y', 'e2', 'me', 1, 1, 1)];
    expect(setsOf(sets, 'e1', 'me').map((s) => s.id)).toEqual(['a', 'c']);
  });

  it('describes what a buddy has logged in the viewer\'s own unit, dimming unfinished sets', () => {
    const sets = [set('a', 'e1', 'pal', 1, 135, 10), set('b', 'e1', 'pal', 2, 155, 8, false), set('c', 'e1', 'pal', 3, 0, 0, false)];
    expect(describeWaltSets(sets, 'weight', lb)).toEqual([
      { text: '135 × 10', done: true },
      { text: '155 × 8', done: false },
    ]);
    expect(describeWaltSets([set('a', 'e1', 'pal', 1, 220.46, 5)], 'weight', kg)[0].text).toBe('100 × 5');
    expect(describeWaltSets([set('a', 'e2', 'pal', 1, 0, 12)], 'reps', lb)[0].text).toBe('12 reps');
    expect(describeWaltSets([set('a', 'e3', 'pal', 1, 0, 1500)], 'time', lb)[0].text).toBe('25:00');
  });

  it('shows my saved weights in my unit when I come back to a session', () => {
    expect(toEditSets([set('a', 'e1', 'me', 1, 220.46, 5)], 'kg')).toEqual([{ id: 'a', weight: '100', reps: '5', completed: true }]);
    expect(toEditSets([set('b', 'e1', 'me', 1, 0, 0, false)], 'lb')).toEqual([{ id: 'b', weight: '', reps: '', completed: false }]);
  });
});

describe('mergeMine', () => {
  const exercises = [ex('e1', 'weight'), ex('e2', 'time', 1)];

  it('gives new exercises blank rows: three to lift, one for a timed exercise', () => {
    n = 0;
    const merged = mergeMine({}, { exercises, sets: [] }, 'me', 'lb', makeId);
    expect(merged.e1).toHaveLength(3);
    expect(merged.e2).toHaveLength(1);
    expect(merged.e1.every((s) => s.weight === '' && s.reps === '' && !s.completed)).toBe(true);
  });

  it('restores sets I already saved, and never overwrites what I am typing', () => {
    const typing: EditSet[] = [{ id: 'mine', weight: '999', reps: '1', completed: false }];
    const merged = mergeMine(
      { e1: typing },
      { exercises, sets: [set('s1', 'e1', 'me', 1, 100, 5), set('s2', 'e2', 'me', 1, 0, 600)] },
      'me', 'lb', makeId,
    );
    expect(merged.e1).toBe(typing); // untouched
    expect(merged.e2).toEqual([{ id: 's2', weight: '', reps: '600', completed: true }]); // restored from the server
  });

  it('drops exercises that were removed from the session', () => {
    const merged = mergeMine(
      { e1: [{ id: 'a', weight: '', reps: '', completed: false }], gone: [] },
      { exercises: [ex('e1', 'weight')], sets: [] }, 'me', 'lb', makeId,
    );
    expect(Object.keys(merged)).toEqual(['e1']);
  });
});

describe('buildWaltDraft', () => {
  const exercises = [ex('b', 'time', 2, null), ex('a', 'weight', 1, 'bench-id'), ex('c', 'reps', 3), ex('d', 'weight', 4, 'unused')];
  const mine: Record<string, EditSet[]> = {
    a: [{ id: 's1', weight: '135', reps: '10', completed: true }, { id: 's2', weight: '', reps: '', completed: false }],
    b: [{ id: 's3', weight: '', reps: '1500', completed: true }],
    c: [{ id: 's4', weight: '20', reps: '12', completed: false }],
    d: [{ id: 's5', weight: '', reps: '', completed: false }],
  };
  const ids = new Map([['a', 'bench-id'], ['b', 'run-id'], ['c', 'dip-id'], ['d', 'unused']]);

  it('keeps shared order, only the sets I logged, and skips exercises where I did nothing', () => {
    const d = buildWaltDraft('Leg day', '2026-10-29T10:00:00Z', exercises, mine, ids);
    expect(d.name).toBe('Leg day');
    expect(d.exercises.map((e) => e.exerciseId)).toEqual(['bench-id', 'run-id', 'dip-id']);
    expect(d.exercises[0].sets).toEqual([{ key: 's1', weight: '135', reps: '10', completed: true }]);
    expect(d.exercises.map((e) => e.repsOnly)).toEqual([false, 'time', true]);
  });

  it('drops the weight for reps-only and timed exercises', () => {
    const d = buildWaltDraft('x', 't', exercises, mine, ids);
    expect(d.exercises[2].sets[0].weight).toBe(''); // the "20" typed on a reps-only exercise is ignored
  });

  it('leaves out an exercise that could not be matched to one of my own', () => {
    const d = buildWaltDraft('x', 't', exercises, mine, new Map([['a', 'bench-id']]));
    expect(d.exercises.map((e) => e.exerciseId)).toEqual(['bench-id']);
  });

  it('saves like a normal workout: volume from weight sets, time kept out of reps', () => {
    const d = buildWaltDraft('Cardio + bench', '2026-10-29T10:00:00.000Z', exercises, mine, ids);
    const row = localToRow(draftToLocal(d, 'lb', 'w1', 'me'));
    const t = workoutTotals(row);
    expect(t.volume).toBe(1350);
    expect(t.seconds).toBe(1500);
    expect(row.workout_exercises.map((e) => e.exercises?.timed)).toEqual([false, true, false]);
  });
});

describe('signed-out errors', () => {
  it('recognises the database refusing a signed-out request and explains it plainly', () => {
    const denied = { code: '42501', message: 'permission denied for table walt_sessions' };
    expect(isSignedOutError(denied)).toBe(true);
    expect(isSignedOutError(new Error('JWT expired'))).toBe(true);
    expect(isSignedOutError(new Error('session_full'))).toBe(false);
    expect(waltErrorMessage(denied)).toBe('You are signed out, or no longer part of this session. Sign in again to keep going.');
    expect(waltErrorMessage(denied)).not.toMatch(/walt_sessions/);
  });
});

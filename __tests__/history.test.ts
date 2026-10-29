import { flattenWorkouts, previousByExercise, workoutToDraftExercises, workoutTotals } from '../src/lib/history';
import type { WorkoutRow } from '../src/types';

const mk = (id: string, completed: string, sets: [number, number][]): WorkoutRow => ({
  id,
  name: id,
  started_at: completed,
  completed_at: completed,
  status: 'completed',
  workout_exercises: [
    {
      id: `${id}-we`,
      position: 1,
      exercise_id: 'bench',
      exercises: { name: 'Bench' },
      workout_sets: sets.map(([weight, reps], i) => ({
        id: `${id}-s${i}`, exercise_id: 'bench', set_order: i + 1, weight, reps, completed: true,
      })),
    },
  ],
});

const newer = mk('new', '2026-10-27T12:00:00Z', [[160, 8]]);
const older = mk('old', '2026-10-20T12:00:00Z', [[135, 10], [155, 8], [175, 6]]);

describe('history helpers', () => {
  it('previousByExercise uses the most recent workout (newest first input)', () => {
    expect(previousByExercise([newer, older]).get('bench')).toEqual([{ weight: 160, reps: 8 }]);
  });
  it('previousByExercise can skip the workout being edited', () => {
    const prev = previousByExercise([newer, older], 'new').get('bench')!;
    expect(prev).toEqual([{ weight: 135, reps: 10 }, { weight: 155, reps: 8 }, { weight: 175, reps: 6 }]);
  });
  it('copying a workout yields uncompleted sets in order', () => {
    const ex = workoutToDraftExercises(older);
    expect(ex[0].sets.map((s) => [s.weight, s.reps, s.completed])).toEqual([
      ['135', '10', false], ['155', '8', false], ['175', '6', false],
    ]);
  });
  it('totals and flatten', () => {
    expect(workoutTotals(older)).toEqual({ volume: 135 * 10 + 155 * 8 + 175 * 6, sets: 3, reps: 24, seconds: 0 });
    expect(flattenWorkouts([older])).toHaveLength(3);
  });
});

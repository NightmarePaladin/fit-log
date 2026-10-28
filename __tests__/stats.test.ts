import { compareWeeks, detectPRs, volume, weeklySeries } from '../src/lib/stats';
import { startOfWeek, weekKey } from '../src/lib/dates';
import type { FlatSet } from '../src/types';

const set = (
  workoutId: string,
  date: string,
  weight: number,
  reps: number,
  completed = true,
  exerciseId = 'sq',
): FlatSet => ({ workoutId, exerciseId, completedAt: new Date(date).toISOString(), weight, reps, completed });

describe('weeks', () => {
  it('starts weeks on Monday (local)', () => {
    expect(weekKey(new Date(2026, 9, 25))).toBe('2026-10-19'); // Sunday belongs to previous Monday
    expect(weekKey(new Date(2026, 9, 26))).toBe('2026-10-26'); // Monday
    expect(weekKey(new Date(2026, 9, 27, 23, 59))).toBe('2026-10-26');
    expect(startOfWeek(new Date(2026, 9, 29)).getDay()).toBe(1);
  });
  it('handles DST fall-back week (US, Nov 1 2026)', () => {
    expect(weekKey(new Date(2026, 10, 1, 12))).toBe('2026-10-26');
    expect(weekKey(new Date(2026, 10, 2, 0, 30))).toBe('2026-11-02');
  });
});

describe('volume', () => {
  it('sums weight x reps for completed sets only', () => {
    expect(
      volume([
        { weight: 100, reps: 10, completed: true },
        { weight: 100, reps: 10, completed: false },
        { weight: 50, reps: 0, completed: true },
      ]),
    ).toBe(1000);
  });
});

describe('compareWeeks', () => {
  const now = new Date(2026, 9, 28, 12); // Wed Oct 28 2026
  it('reports +4.4% at the same reps (225 -> 235 x10)', () => {
    const sets = [set('a', '2026-10-21T12:00:00', 225, 10), set('b', '2026-10-27T12:00:00', 235, 10)];
    const c = compareWeeks(sets, 'sq', now);
    expect(c.weightDelta).toBe(10);
    expect(c.likeForLike).toBe(true);
    expect(c.strengthChangePct).toBeCloseTo(4.44, 1);
    expect(c.previous.volume).toBe(2250);
    expect(c.current.volume).toBe(2350);
  });
  it('does not report strength % when reps differ', () => {
    const sets = [set('a', '2026-10-21T12:00:00', 225, 10), set('b', '2026-10-27T12:00:00', 245, 5)];
    const c = compareWeeks(sets, 'sq', now);
    expect(c.weightDelta).toBe(20);
    expect(c.strengthChangePct).toBeNull();
    expect(c.likeForLike).toBe(false);
    expect(c.note).toMatch(/not a like-for-like/);
  });
  it('ignores incomplete sets and other weeks', () => {
    const sets = [
      set('a', '2026-10-21T12:00:00', 225, 10),
      set('b', '2026-10-27T12:00:00', 300, 10, false),
      set('c', '2026-10-10T12:00:00', 500, 10),
    ];
    const c = compareWeeks(sets, 'sq', now);
    expect(c.current.bestWeight).toBeNull();
    expect(c.weightDelta).toBeNull();
  });
  it('treats Sunday as the end of the previous week', () => {
    const sets = [set('a', '2026-10-25T20:00:00', 200, 5), set('b', '2026-10-26T08:00:00', 205, 5)];
    const c = compareWeeks(sets, 'sq', now);
    expect(c.previous.bestWeight).toBe(200);
    expect(c.current.bestWeight).toBe(205);
  });
});

describe('detectPRs', () => {
  it('first log is a baseline, later heavier sets are PRs', () => {
    const sets = [
      set('a', '2026-10-05T12:00:00', 200, 5),
      set('b', '2026-10-12T12:00:00', 200, 5),
      set('c', '2026-10-19T12:00:00', 210, 5),
    ];
    const prs = detectPRs(sets);
    expect(prs).toHaveLength(1);
    expect(prs[0]).toMatchObject({ workoutId: 'c', weight: 210, kind: 'weight' });
  });
  it('detects rep PRs at the same weight', () => {
    const sets = [set('a', '2026-10-05T12:00:00', 200, 5), set('b', '2026-10-12T12:00:00', 200, 7)];
    expect(detectPRs(sets)[0]).toMatchObject({ kind: 'reps', reps: 7 });
  });
  it('ignores uncompleted sets', () => {
    const sets = [set('a', '2026-10-05T12:00:00', 200, 5), set('b', '2026-10-12T12:00:00', 400, 5, false)];
    expect(detectPRs(sets)).toHaveLength(0);
  });
});

describe('weeklySeries', () => {
  it('returns oldest to newest with gaps as null', () => {
    const now = new Date(2026, 9, 28, 12);
    const pts = weeklySeries([set('a', '2026-10-27T12:00:00', 235, 10)], 'sq', 3, now);
    expect(pts.map((p) => p.key)).toEqual(['2026-10-12', '2026-10-19', '2026-10-26']);
    expect(pts[0].bestWeight).toBeNull();
    expect(pts[2].bestWeight).toBe(235);
  });
});

describe('reps-only (bodyweight) exercises', () => {
  const now = new Date(2026, 9, 28, 12); // Wed Oct 28 2026
  const pu = (id: string, date: string, reps: number, completed = true) => set(id, date, 0, reps, completed, 'pushup');

  it('compares best single-set reps and total reps week over week', () => {
    const sets = [
      pu('a', '2026-10-21T12:00:00', 10), pu('a', '2026-10-21T12:05:00', 8),
      pu('b', '2026-10-27T12:00:00', 12), pu('b', '2026-10-27T12:05:00', 9), pu('b', '2026-10-27T12:10:00', 9),
    ];
    const c = compareWeeks(sets, 'pushup', now);
    expect(c.previous.maxReps).toBe(10);
    expect(c.current.maxReps).toBe(12);
    expect(c.repsDelta).toBe(2);
    expect(c.repsChangePct).toBeCloseTo(20, 5);
    expect(c.previous.totalReps).toBe(18);
    expect(c.current.totalReps).toBe(30);
    expect(c.totalRepsDelta).toBe(12);
    expect(c.totalRepsChangePct).toBeCloseTo(66.67, 1);
    expect(c.current.volume).toBe(0); // no weight, so no volume
    expect(c.strengthChangePct).toBeNull(); // never reported as a weight/strength percentage
  });

  it('ignores uncompleted sets and reports null when a week is missing', () => {
    const c = compareWeeks([pu('a', '2026-10-21T12:00:00', 10), pu('b', '2026-10-27T12:00:00', 30, false)], 'pushup', now);
    expect(c.current.maxReps).toBeNull();
    expect(c.repsDelta).toBeNull();
    expect(c.repsChangePct).toBeNull();
  });

  it('a rep PR is detected when weight is always 0', () => {
    const prs = detectPRs([pu('a', '2026-10-05T12:00:00', 10), pu('b', '2026-10-12T12:00:00', 10), pu('c', '2026-10-19T12:00:00', 12)]);
    expect(prs).toHaveLength(1);
    expect(prs[0]).toMatchObject({ workoutId: 'c', reps: 12, weight: 0, kind: 'reps' });
  });

  it('weekly series carries reps numbers for charts', () => {
    const pts = weeklySeries([pu('a', '2026-10-27T12:00:00', 12), pu('b', '2026-10-27T12:30:00', 8)], 'pushup', 2, now);
    expect(pts[1]).toMatchObject({ maxReps: 12, totalReps: 20, volume: 0 });
    expect(pts[0].maxReps).toBeNull();
  });
});

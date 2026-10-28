import { addWeeks, formatWeekLabel, startOfWeek, weekKey } from './dates';
import type { FlatSet, SetRecord } from '../types';

const isWorking = (s: SetRecord) => s.completed && s.reps > 0 && s.weight >= 0;

/** Training volume = Σ weight × reps over completed working sets. */
export function volume(sets: SetRecord[]): number {
  return sets.filter(isWorking).reduce((sum, s) => sum + s.weight * s.reps, 0);
}

/** Heaviest completed set; ties broken by more reps. */
export function bestSet(sets: SetRecord[]): SetRecord | null {
  let best: SetRecord | null = null;
  for (const s of sets) {
    if (!isWorking(s)) continue;
    if (!best || s.weight > best.weight || (s.weight === best.weight && s.reps > best.reps)) best = s;
  }
  return best;
}

export type WeekSummary = {
  bestWeight: number | null;
  bestReps: number | null;
  volume: number;
  setCount: number;
};

export function summarize(sets: SetRecord[]): WeekSummary {
  const best = bestSet(sets);
  return {
    bestWeight: best?.weight ?? null,
    bestReps: best?.reps ?? null,
    volume: volume(sets),
    setCount: sets.filter(isWorking).length,
  };
}

const pct = (from: number, to: number) => (from > 0 ? ((to - from) / from) * 100 : null);

export type WeekComparison = {
  previous: WeekSummary;
  current: WeekSummary;
  weightDelta: number | null;
  weightChangePct: number | null;
  volumeDelta: number;
  volumeChangePct: number | null;
  /**
   * % change in weight lifted, ONLY when the best sets used the same rep count.
   * null otherwise: a heavier weight at different reps is not a like-for-like
   * strength change, so we never present it as a general strength percentage.
   */
  strengthChangePct: number | null;
  likeForLike: boolean;
  note: string;
};

export function compareWeeks(
  sets: FlatSet[],
  exerciseId: string | null,
  now: Date = new Date(),
): WeekComparison {
  const curStart = startOfWeek(now);
  const prevStart = addWeeks(curStart, -1);
  const curKey = weekKey(curStart);
  const prevKey = weekKey(prevStart);
  const relevant = sets.filter((s) => (exerciseId ? s.exerciseId === exerciseId : true));
  const cur = summarize(relevant.filter((s) => weekKey(new Date(s.completedAt)) === curKey));
  const prev = summarize(relevant.filter((s) => weekKey(new Date(s.completedAt)) === prevKey));

  const haveBoth = cur.bestWeight != null && prev.bestWeight != null;
  const weightDelta = haveBoth ? cur.bestWeight! - prev.bestWeight! : null;
  const likeForLike = haveBoth && cur.bestReps === prev.bestReps && exerciseId != null;
  const strengthChangePct = likeForLike ? pct(prev.bestWeight!, cur.bestWeight!) : null;

  let note: string;
  if (!haveBoth) note = 'Log this lift in both weeks to compare.';
  else if (exerciseId == null) note = 'Pick one exercise to compare strength.';
  else if (likeForLike) note = `Same reps (${cur.bestReps}): weight change is a true strength comparison.`;
  else
    note = `Best sets used different reps (${prev.bestReps} → ${cur.bestReps}), so this is not a like-for-like strength change.`;

  return {
    previous: prev,
    current: cur,
    weightDelta,
    weightChangePct: haveBoth ? pct(prev.bestWeight!, cur.bestWeight!) : null,
    volumeDelta: cur.volume - prev.volume,
    volumeChangePct: pct(prev.volume, cur.volume),
    strengthChangePct,
    likeForLike,
    note,
  };
}

export type PR = {
  exerciseId: string;
  workoutId: string;
  weight: number;
  reps: number;
  completedAt: string;
  kind: 'weight' | 'reps';
};

/**
 * A PR is a completed set that beats everything logged earlier for that exercise:
 * a heavier weight, or more reps at the same weight. The first time an exercise is
 * ever logged sets the baseline and is not a PR. One PR per exercise per workout.
 */
export function detectPRs(sets: FlatSet[]): PR[] {
  const byWorkout = new Map<string, FlatSet[]>();
  for (const s of sets) {
    if (!isWorking(s)) continue;
    const k = `${s.workoutId}|${s.exerciseId}`;
    byWorkout.set(k, [...(byWorkout.get(k) ?? []), s]);
  }
  const groups = [...byWorkout.values()].sort(
    (a, b) => new Date(a[0].completedAt).getTime() - new Date(b[0].completedAt).getTime(),
  );
  const maxWeight = new Map<string, number>();
  const maxRepsAt = new Map<string, number>(); // `${exercise}|${weight}` -> reps
  const prs: PR[] = [];
  for (const g of groups) {
    const ex = g[0].exerciseId;
    const prevMax = maxWeight.get(ex);
    const top = bestSet(g)!;
    if (prevMax !== undefined) {
      if (top.weight > prevMax) {
        prs.push({ exerciseId: ex, workoutId: g[0].workoutId, weight: top.weight, reps: top.reps, completedAt: g[0].completedAt, kind: 'weight' });
      } else {
        const repSet = g
          .filter((s) => s.weight === top.weight)
          .reduce((a, b) => (b.reps > a.reps ? b : a));
        const prior = maxRepsAt.get(`${ex}|${repSet.weight}`);
        if (prior !== undefined && repSet.reps > prior) {
          prs.push({ exerciseId: ex, workoutId: g[0].workoutId, weight: repSet.weight, reps: repSet.reps, completedAt: g[0].completedAt, kind: 'reps' });
        }
      }
    }
    for (const s of g) {
      maxWeight.set(ex, Math.max(maxWeight.get(ex) ?? 0, s.weight));
      const rk = `${ex}|${s.weight}`;
      maxRepsAt.set(rk, Math.max(maxRepsAt.get(rk) ?? 0, s.reps));
    }
  }
  return prs.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
}

export type WeekPoint = { key: string; label: string; bestWeight: number | null; volume: number };

/** Oldest → newest series of weekly best weight and volume for charts. */
export function weeklySeries(
  sets: FlatSet[],
  exerciseId: string | null,
  weeks = 8,
  now: Date = new Date(),
): WeekPoint[] {
  const relevant = sets.filter((s) => (exerciseId ? s.exerciseId === exerciseId : true));
  const start = startOfWeek(now);
  const out: WeekPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = addWeeks(start, -i);
    const key = weekKey(ws);
    const sum = summarize(relevant.filter((s) => weekKey(new Date(s.completedAt)) === key));
    out.push({ key, label: formatWeekLabel(ws), bestWeight: sum.bestWeight, volume: sum.volume });
  }
  return out;
}

export const fmtPct = (n: number | null) =>
  n == null ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
export const fmtNum = (n: number | null) => (n == null ? '—' : Math.round(n).toLocaleString());

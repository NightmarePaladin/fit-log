import { formatDay } from './dates';
import { formatDuration, repsModeOf, type RepsMode, type UnitFormat } from './units';
import { workoutTotals } from './history';
import type { WorkoutRow } from '../types';

export type ShareCardData = {
  owner: string;
  title: string;
  date: string;
  rows: { name: string; detail: string }[];
  total: string;
};

type SetLike = { weight: number; reps: number; completed: boolean };

/** "3 × 10 @ 135 lb", "135×10 · 155×8 · 175×6", or "15 · 12 · 10 reps" for reps-only moves. */
export function describeSets(sets: SetLike[], repsOnly: RepsMode, u: UnitFormat, maxShown = 4): string {
  const done = sets.filter((s) => s.completed && s.reps > 0);
  if (done.length === 0) return '';
  if (repsOnly === 'time') {
    const shown = done.slice(0, maxShown).map((s) => formatDuration(s.reps)).join(' · ');
    return `${shown}${done.length > maxShown ? ` +${done.length - maxShown}` : ''}`;
  }
  if (repsOnly && done.every((s) => s.weight === 0)) {
    const shown = done.slice(0, maxShown).map((s) => s.reps).join(' · ');
    return `${shown}${done.length > maxShown ? ` +${done.length - maxShown}` : ''} reps`;
  }
  const first = done[0];
  if (done.length > 1 && done.every((s) => s.weight === first.weight && s.reps === first.reps)) {
    return `${done.length} × ${first.reps} @ ${u.fmt(first.weight)} ${u.label}`;
  }
  const shown = done.slice(0, maxShown).map((s) => `${u.fmt(s.weight)}×${s.reps}`).join(' · ');
  return `${shown}${done.length > maxShown ? ` +${done.length - maxShown} more` : ''} ${u.label}`;
}

/** What goes on the picture and into the text: finished exercises only. */
export function buildShareCard(w: WorkoutRow, u: UnitFormat, owner: string): ShareCardData {
  const rows = [...w.workout_exercises]
    .sort((a, b) => a.position - b.position)
    .map((we) => ({
      name: we.exercises?.name ?? 'Exercise',
      detail: describeSets(
        we.workout_sets.map((s) => ({ weight: Number(s.weight), reps: s.reps, completed: s.completed })),
        repsModeOf(we.exercises),
        u,
      ),
    }))
    .filter((r) => r.detail);
  const t = workoutTotals(w);
  return {
    owner,
    title: w.name || 'Workout',
    date: w.completed_at ? formatDay(w.completed_at) : '',
    rows,
    total:
      t.volume > 0
        ? `${u.vol(t.volume)} ${u.label} lifted`
        : [t.reps > 0 ? `${t.reps} total reps` : '', t.seconds > 0 ? `${formatDuration(t.seconds)} total time` : '']
            .filter(Boolean)
            .join(' · '),
  };
}

/** Plain-text version for messages and social posts. */
export function buildShareText(card: ShareCardData, link?: string | null): string {
  const lines = [
    `${card.owner ? `${card.owner}'s` : 'My'} workout on Fit Log: ${card.title}${card.date ? ` (${card.date})` : ''}`,
    ...card.rows.map((r) => `• ${r.name}: ${r.detail}`),
    card.total,
    'Log Lifts Fast.',
  ];
  if (link) lines.push(link);
  return lines.join('\n');
}

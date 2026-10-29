jest.mock('../src/lib/supabase', () => ({ supabase: {} }));

import { buddyErrorMessage } from '../src/api/buddies';
import { buildShareCard, buildShareText, describeSets } from '../src/lib/shareCard';
import { localToRow } from '../src/lib/localData';
import { makeUnitFormat } from '../src/lib/units';
import type { LocalWorkout } from '../src/types';

const lb = makeUnitFormat('lb');
const done = (weight: number, reps: number, completed = true) => ({ weight, reps, completed });

describe('describeSets', () => {
  it('collapses identical sets and lists varied ones', () => {
    expect(describeSets([done(135, 10), done(135, 10), done(135, 10)], false, lb)).toBe('3 × 10 @ 135 lb');
    expect(describeSets([done(135, 10), done(155, 8), done(175, 6)], false, lb)).toBe('135×10 · 155×8 · 175×6 lb');
    expect(describeSets([done(100, 5)], false, lb)).toBe('100×5 lb');
  });
  it('shows reps only for bodyweight work and trims long lists', () => {
    expect(describeSets([done(0, 15), done(0, 12), done(0, 10)], true, lb)).toBe('15 · 12 · 10 reps');
    expect(describeSets([1, 2, 3, 4, 5, 6].map((r) => done(0, r)), true, lb)).toBe('1 · 2 · 3 · 4 +2 reps');
  });
  it('ignores sets that were not completed and converts to kg', () => {
    expect(describeSets([done(135, 10, false)], false, lb)).toBe('');
    expect(describeSets([done(225, 5), done(225, 5)], false, makeUnitFormat('kg'))).toBe('2 × 5 @ 102.06 kg');
  });
});

describe('share card and text', () => {
  const w: LocalWorkout = {
    id: 'w', ownerId: 'u', name: 'Push Day', startedAt: '2026-10-28T18:00:00', completedAt: '2026-10-28T19:00:00',
    exercises: [
      { exerciseId: 'b', name: 'Barbell Bench Press', sets: [done(135, 10), done(135, 10)] },
      { exerciseId: 'p', name: 'Push-Up', repsOnly: true, sets: [done(0, 20)] },
      { exerciseId: 'x', name: 'Skipped', sets: [done(50, 10, false)] },
    ],
  };
  const card = buildShareCard(localToRow(w), lb, 'Jay');

  it('lists only finished exercises with a total', () => {
    expect(card.title).toBe('Push Day');
    expect(card.owner).toBe('Jay');
    expect(card.rows).toEqual([
      { name: 'Barbell Bench Press', detail: '2 × 10 @ 135 lb' },
      { name: 'Push-Up', detail: '20 reps' },
    ]);
    expect(card.total).toBe('2,700 lb lifted');
  });
  it('a reps-only workout reports total reps instead of weight', () => {
    const only = buildShareCard(localToRow({ ...w, exercises: [w.exercises[1]] }), lb, '');
    expect(only.total).toBe('20 total reps');
  });
  it('text includes the exercises, tagline and optional link', () => {
    const t = buildShareText(card, 'https://example.com/s/abc');
    expect(t).toContain("Jay's workout on Fit Lift: Push Day");
    expect(t).toContain('• Barbell Bench Press: 2 × 10 @ 135 lb');
    expect(t).toContain('Log Lifts Fast.');
    expect(t.endsWith('https://example.com/s/abc')).toBe(true);
    expect(buildShareText(card)).not.toContain('https://');
  });
});

describe('buddyErrorMessage', () => {
  it('turns database codes into plain sentences', () => {
    expect(buddyErrorMessage({ message: 'invalid_or_expired_code' })).toMatch(/not valid or has expired/);
    expect(buddyErrorMessage({ message: 'own_code' })).toMatch(/your own code/);
    expect(buddyErrorMessage({ message: 'too_many_active_invites' })).toMatch(/5 active invites/);
    expect(buddyErrorMessage(new TypeError('Network request failed'))).toMatch(/internet connection/);
    expect(buddyErrorMessage(new Error('something odd'))).toBe('something odd');
  });
});

import { useEffect, useState } from 'react';
import { create } from 'zustand';

/**
 * The workout stopwatch. It stores timestamps, not a ticking counter, so it stays accurate while the app is in the
 * background or the workout screen is minimized. Not persisted: a timer is for this session.
 */
type TimerState = {
  /** epoch ms when it last started running; null while paused/stopped */
  startedAt: number | null;
  /** ms accumulated before the current run */
  accMs: number;
  start: () => void;
  pause: () => void;
  reset: () => void;
};

export const useTimerStore = create<TimerState>((set, get) => ({
  startedAt: null,
  accMs: 0,
  start: () => {
    if (get().startedAt == null) set({ startedAt: Date.now() });
  },
  pause: () => {
    const { startedAt, accMs } = get();
    if (startedAt != null) set({ startedAt: null, accMs: accMs + (Date.now() - startedAt) });
  },
  reset: () => set({ startedAt: null, accMs: 0 }),
}));

export const elapsedMs = (s: Pick<TimerState, 'startedAt' | 'accMs'>, now = Date.now()) =>
  s.accMs + (s.startedAt != null ? now - s.startedAt : 0);

/** Whole seconds on the timer, re-rendering about 4 times a second while it runs. */
export function useElapsedSeconds(): number {
  const startedAt = useTimerStore((s) => s.startedAt);
  const accMs = useTimerStore((s) => s.accMs);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt == null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [startedAt]);
  return Math.floor(elapsedMs({ startedAt, accMs }, startedAt != null ? Math.max(now, startedAt) : now) / 1000);
}

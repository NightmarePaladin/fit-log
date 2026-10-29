import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addSessionExercise, deleteMySets, fetchSnapshot, removeSessionExercise, subscribeToSession, upsertMySets,
} from '../api/walt';
import { newId } from '../lib/id';
import type { Unit } from '../lib/units';
import { mergeMine, waltErrorMessage, type EditSet, type WaltMode, type WaltSnapshot } from '../lib/walt';

const POLL_MS = 8000; // safety net: the live socket does the real work, this catches anything it drops
const SAVE_DELAY_MS = 600; // wait for a pause in typing before sending my sets

/**
 * A live W.A.L.T. session. `snap` is everyone's data from the server (kept fresh by realtime events plus a slow
 * poll). `mine` is MY sets as I am editing them on this device: typing never waits on the network, and changes are
 * sent to the server a moment later. Other people's sets come from `snap`.
 */
export function useWaltSession(sessionId: string, userId: string, unit: Unit) {
  const [snap, setSnap] = useState<WaltSnapshot | null>(null);
  const [mine, setMine] = useState<Record<string, EditSet[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState(false);

  const mineRef = useRef(mine);
  const dirty = useRef(new Map<string, string>()); // set id -> exercise id, for sets not yet sent
  const removed = useRef(new Set<string>());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushing = useRef<Promise<void> | null>(null);
  const unitRef = useRef(unit);
  const ended = useRef(false);

  useEffect(() => {
    mineRef.current = mine;
    unitRef.current = unit;
    ended.current = snap?.session.status === 'ended';
  }, [mine, unit, snap]);

  const refresh = useCallback(async () => {
    try {
      const s = await fetchSnapshot(sessionId);
      setSnap(s);
      setMine((prev) => mergeMine(prev, s, userId, unitRef.current, newId));
      setError(null);
    } catch (e) {
      setError(waltErrorMessage(e));
    }
  }, [sessionId, userId]);

  /** Send my changed sets (and deleted ones) to the server. Safe to call any time; calls queue behind each other. */
  const flush = useCallback(async (): Promise<void> => {
    if (flushing.current) await flushing.current.catch(() => {});
    const changed = new Map(dirty.current);
    const gone = [...removed.current];
    if (changed.size === 0 && gone.length === 0) return;
    dirty.current.clear();
    removed.current.clear();
    const run = (async () => {
      try {
        const rows: { exerciseId: string; order: number; set: EditSet }[] = [];
        for (const [setId, exerciseId] of changed) {
          const list = mineRef.current[exerciseId] ?? [];
          const i = list.findIndex((s) => s.id === setId);
          if (i >= 0) rows.push({ exerciseId, order: i + 1, set: list[i] });
        }
        await deleteMySets(gone);
        await upsertMySets(sessionId, userId, rows, unitRef.current);
        setSyncError(false);
      } catch (e) {
        // Put them back so the next flush retries. After the host ends the session, writes are refused: stop retrying.
        if (!ended.current) {
          for (const [k, v] of changed) dirty.current.set(k, v);
          for (const g of gone) removed.current.add(g);
          setSyncError(true);
        }
        throw e;
      }
    })();
    flushing.current = run;
    try {
      await run;
    } finally {
      if (flushing.current === run) flushing.current = null;
    }
  }, [sessionId, userId]);

  const scheduleFlush = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      flush().catch(() => {});
    }, SAVE_DELAY_MS);
  }, [flush]);

  useEffect(() => {
    const first = setTimeout(refresh, 0); // load right away (via a timer, so no state is set during the effect itself)
    const scheduleRefresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(refresh, 300);
    };
    const stop = subscribeToSession(sessionId, scheduleRefresh);
    const poll = setInterval(() => {
      refresh();
      if (dirty.current.size > 0 || removed.current.size > 0) flush().catch(() => {});
    }, POLL_MS);
    return () => {
      stop();
      clearTimeout(first);
      clearInterval(poll);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      flush().catch(() => {}); // best effort: don't lose the last thing typed
    };
  }, [sessionId, refresh, flush]);

  const updateSet = useCallback(
    (exerciseId: string, setId: string, patch: Partial<Omit<EditSet, 'id'>>) => {
      setMine((prev) => ({
        ...prev,
        [exerciseId]: (prev[exerciseId] ?? []).map((s) => (s.id === setId ? { ...s, ...patch } : s)),
      }));
      dirty.current.set(setId, exerciseId);
      scheduleFlush();
    },
    [scheduleFlush],
  );

  const addSet = useCallback((exerciseId: string) => {
    setMine((prev) => {
      const list = prev[exerciseId] ?? [];
      const last = list[list.length - 1];
      // like the solo workout screen: a new set starts from the previous set's weight
      return { ...prev, [exerciseId]: [...list, { id: newId(), weight: last?.weight ?? '', reps: '', completed: false }] };
    });
  }, []);

  const removeSet = useCallback(
    (exerciseId: string, setId: string) => {
      const list = mineRef.current[exerciseId] ?? [];
      if (list.length <= 1) return;
      removed.current.add(setId);
      dirty.current.delete(setId);
      const rest = list.filter((s) => s.id !== setId);
      for (const s of rest) dirty.current.set(s.id, exerciseId); // their order numbers shift
      setMine((prev) => ({ ...prev, [exerciseId]: rest }));
      scheduleFlush();
    },
    [scheduleFlush],
  );

  const addExercise = useCallback(
    async (ex: { name: string; mode: WaltMode; exerciseId: string | null }) => {
      await addSessionExercise(sessionId, { ...ex, position: snap?.exercises.length ?? 0 });
      await refresh();
    },
    [sessionId, snap, refresh],
  );

  const removeExercise = useCallback(
    async (id: string) => {
      await removeSessionExercise(id);
      await refresh();
    },
    [refresh],
  );

  return { snap, mine, loading: snap === null && error === null, error, syncError, refresh, flush, updateSet, addSet, removeSet, addExercise, removeExercise };
}

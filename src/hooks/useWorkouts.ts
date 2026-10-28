import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { fetchWorkouts } from '../api/workouts';
import { useAuth } from '../auth/AuthProvider';
import { mergeWorkouts, visibleTo } from '../lib/localData';
import { isNetworkError } from '../lib/net';
import { hasLiveSession } from '../lib/session';
import { useLocalStore } from '../store/local';
import type { WorkoutRow } from '../types';
import { useOnline } from './useOnline';

/**
 * Completed workouts, newest first: the server's copy (or the last cached copy when offline) plus any
 * workouts saved on this phone that have not been uploaded yet. Reloads every time the screen gains focus.
 */
export function useWorkouts() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const online = useOnline();
  const pending = useLocalStore((s) => s.workouts);
  const cached = useLocalStore((s) => (userId ? s.cache[userId]?.workouts : undefined));

  const [server, setServer] = useState<WorkoutRow[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loading = !!userId && loadedFor !== userId; // offline (no account) mode has nothing to wait for
  const [error, setError] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  const mine = useMemo(() => visibleTo(pending, userId), [pending, userId]);
  const pendingCount = mine.length;

  const refresh = useCallback(async () => {
    if (!userId) return; // offline (no account) mode: only what is saved on this phone
    try {
      const live = await hasLiveSession();
      setError(null);
      if (!live) throw new Error('offline');
      const rows = await fetchWorkouts();
      setServer(rows);
      setUnreachable(false);
      useLocalStore.getState().setCache(userId, { workouts: rows });
    } catch (e) {
      if (isNetworkError(e) || (e instanceof Error && e.message === 'offline')) {
        setUnreachable(true); // fall back to the cached copy below
      } else {
        setError(e instanceof Error ? e.message : 'Could not load workouts');
      }
    } finally {
      setLoadedFor(userId);
    }
  }, [userId]);

  // Reload on focus, when the connection changes, and when a queued workout finishes uploading.
  const reloadKey = `${online}:${pendingCount}`;
  useFocusEffect(
    useCallback(() => {
      if (reloadKey) refresh();
    }, [refresh, reloadKey]),
  );

  const offline = !online || unreachable;
  const workouts = useMemo(
    () => mergeWorkouts(offline ? (cached ?? server) : server, mine),
    [offline, cached, server, mine],
  );

  return { workouts, loading, error, refresh, offline, pendingCount };
}

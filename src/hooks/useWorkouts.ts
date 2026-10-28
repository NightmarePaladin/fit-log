import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { fetchWorkouts } from '../api/workouts';
import type { WorkoutRow } from '../types';

/** Loads completed workouts (newest first) every time the screen gains focus. */
export function useWorkouts() {
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setWorkouts(await fetchWorkouts());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load workouts');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return { workouts, loading, error, refresh };
}

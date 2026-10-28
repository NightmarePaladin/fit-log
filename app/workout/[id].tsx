import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Button, IconButton, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { showDialog } from '../../src/lib/dialog';
import { deleteWorkout, fetchWorkout } from '../../src/api/workouts';
import { useAuth } from '../../src/auth/AuthProvider';
import { Card, ErrorBanner } from '../../src/components/ui';
import { formatDay } from '../../src/lib/dates';
import { useUnits } from '../../src/hooks/useUnits';
import { workoutToDraftExercises, workoutTotals } from '../../src/lib/history';
import { useDraftStore } from '../../src/store/draft';
import { colors } from '../../src/theme';
import type { WorkoutRow } from '../../src/types';

export default function WorkoutDetail() {
  const { id, saved } = useLocalSearchParams<{ id: string; saved?: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const u = useUnits();
  const [w, setW] = useState<WorkoutRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setW(await fetchWorkout(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load workout');
    } finally {
      setLoading(false);
    }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const userId = session?.user.id ?? '';
  const closeToTabs = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const withDraftGuard = (fn: () => void) => {
    const existing = useDraftStore.getState().draft;
    if (!existing) return fn();
    showDialog('Replace unfinished workout?', 'You already have a workout in progress. Starting this will discard it.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Replace', style: 'destructive', onPress: fn },
    ]);
  };

  const repeat = () =>
    withDraftGuard(() => {
      if (!w) return;
      useDraftStore.getState().start(userId, workoutToDraftExercises(w, false, u.unit), { name: w.name ?? '' });
      router.push('/active');
    });

  const edit = () =>
    withDraftGuard(() => {
      if (!w) return;
      useDraftStore.getState().start(userId, workoutToDraftExercises(w, true, u.unit), {
        name: w.name ?? '',
        startedAt: w.started_at,
        completedAt: w.completed_at ?? undefined,
        editingWorkoutId: w.id,
      });
      router.push('/active');
    });

  const remove = () =>
    showDialog('Delete this workout?', 'This permanently removes it and its sets.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteWorkout(id);
            closeToTabs();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not delete workout');
          }
        },
      },
    ]);

  const totals = w ? workoutTotals(w) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }}>
        <IconButton icon="arrow-left" onPress={closeToTabs} accessibilityLabel="Back" />
        <Text variant="titleLarge" style={{ flex: 1, fontWeight: '800' }}>{w?.name ?? 'Workout'}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        {saved === '1' && (
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16,
              backgroundColor: 'rgba(61,220,151,0.15)', borderWidth: 1, borderColor: colors.success,
            }}
          >
            <MaterialCommunityIcons name="check-circle" size={24} color={colors.success} />
            <Text style={{ color: colors.success, fontWeight: '800', fontSize: 16 }}>Workout saved</Text>
          </View>
        )}
        {loading && <ActivityIndicator color={colors.accent} />}
        {error && <ErrorBanner message={error} onRetry={load} />}
        {!loading && !w && !error && <Text style={{ color: colors.muted }}>This workout no longer exists.</Text>}

        {w && totals && (
          <>
            <Text style={{ color: colors.muted }}>{formatDay(w.completed_at!)}</Text>
            <Card style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 30, fontWeight: '800' }}>{totals.sets}</Text>
                <Text style={{ color: colors.muted }}>sets</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 30, fontWeight: '800', color: colors.accent }}>{u.vol(totals.volume)}</Text>
                <Text style={{ color: colors.muted }}>{u.label} volume</Text>
              </View>
            </Card>

            {[...w.workout_exercises].sort((a, b) => a.position - b.position).map((we) => (
              <Card key={we.id} style={{ gap: 6 }}>
                <Text style={{ fontSize: 18, fontWeight: '800' }}>{we.exercises?.name}</Text>
                {[...we.workout_sets].sort((a, b) => a.set_order - b.set_order).map((s) => (
                  <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ width: 24, color: colors.muted, fontWeight: '700' }}>{s.set_order}</Text>
                    <Text style={{ flex: 1, fontSize: 20, fontWeight: '700' }}>{u.set(Number(s.weight), s.reps)}</Text>
                    <MaterialCommunityIcons
                      name={s.completed ? 'check-circle' : 'circle-outline'}
                      size={22}
                      color={s.completed ? colors.success : colors.muted}
                    />
                  </View>
                ))}
              </Card>
            ))}

            <Button mode="contained" icon="repeat" onPress={repeat} contentStyle={{ height: 52 }} style={{ borderRadius: 16 }}>
              Repeat this workout
            </Button>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button mode="outlined" icon="pencil" onPress={edit} style={{ flex: 1 }}>Edit</Button>
              <Button mode="outlined" icon="delete" textColor={colors.danger} onPress={remove} style={{ flex: 1 }}>
                Delete
              </Button>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

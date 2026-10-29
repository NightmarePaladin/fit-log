import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Button, IconButton, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { showDialog } from '../../src/lib/dialog';
import { deleteWorkout, fetchWorkout } from '../../src/api/workouts';
import { useAuth } from '../../src/auth/AuthProvider';
import { ShareSheet } from '../../src/components/ShareSheet';
import { Card, ErrorBanner } from '../../src/components/ui';
import { formatDay } from '../../src/lib/dates';
import { useUnits } from '../../src/hooks/useUnits';
import { workoutToDraftExercises, workoutTotals } from '../../src/lib/history';
import { localToRow } from '../../src/lib/localData';
import { isNetworkError } from '../../src/lib/net';
import { useDraftStore } from '../../src/store/draft';
import { GUEST, useLocalStore } from '../../src/store/local';
import { colors, useScheme } from '../../src/theme';
import type { WorkoutRow } from '../../src/types';

export default function WorkoutDetail() {
  useScheme(); // re-render when the appearance changes
  const { id, saved } = useLocalSearchParams<{ id: string; saved?: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const u = useUnits();
  const userIdOrNull = session?.user.id ?? null;
  const [shareOpen, setShareOpen] = useState(false);
  const [w, setW] = useState<WorkoutRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      // A workout saved on this device (not uploaded yet) takes priority over the server copy.
      const local = useLocalStore.getState().workouts.find((x) => x.id === id);
      if (local) {
        setW(localToRow(local));
        return;
      }
      setW(await fetchWorkout(id));
    } catch (e) {
      if (isNetworkError(e)) {
        // Offline: show the last cached copy if we have one.
        const cached = (userIdOrNull ? useLocalStore.getState().cache[userIdOrNull]?.workouts : undefined)?.find((x) => x.id === id);
        if (cached) {
          setW(cached);
          return;
        }
        setError('You are offline and this workout is not saved on this device.');
        return;
      }
      setError(e instanceof Error ? e.message : 'Could not load workout');
    } finally {
      setLoading(false);
    }
  }, [id, userIdOrNull]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const userId = session?.user.id ?? GUEST;
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
            // Signed in: remove the server copy first (a never-uploaded workout simply has nothing to remove there).
            if (session) await deleteWorkout(id);
            useLocalStore.getState().removeWorkout(id);
            closeToTabs();
          } catch (e) {
            setError(
              isNetworkError(e)
                ? 'Deleting needs an internet connection. Try again when you are online.'
                : e instanceof Error ? e.message : 'Could not delete workout',
            );
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
        {w && <IconButton icon="share-variant" onPress={() => setShareOpen(true)} accessibilityLabel="Share workout" />}
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        {saved === 'queued' && (
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16,
              backgroundColor: 'rgba(76,141,255,0.15)', borderWidth: 1, borderColor: colors.blue,
            }}
          >
            <MaterialCommunityIcons name="content-save-check" size={24} color={colors.blue} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.blue, fontWeight: '800', fontSize: 16 }}>Saved on this device</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {session ? 'It will upload automatically when you are back online.' : 'Sign in later to upload it to your account.'}
              </Text>
            </View>
          </View>
        )}
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
            <Text style={{ color: colors.muted }}>
              {formatDay(w.completed_at!)}
              {w.pending ? '  ·  Not uploaded yet' : ''}
            </Text>
            <Card style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 30, fontWeight: '800' }}>{totals.sets}</Text>
                <Text style={{ color: colors.muted }}>sets</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 30, fontWeight: '800', color: colors.accent }}>{totals.volume > 0 ? u.vol(totals.volume) : totals.reps}</Text>
                <Text style={{ color: colors.muted }}>{totals.volume > 0 ? `${u.label} volume` : 'total reps'}</Text>
              </View>
            </Card>

            {[...w.workout_exercises].sort((a, b) => a.position - b.position).map((we) => (
              <Card key={we.id} style={{ gap: 6 }}>
                <Text style={{ fontSize: 18, fontWeight: '800' }}>{we.exercises?.name}</Text>
                {[...we.workout_sets].sort((a, b) => a.set_order - b.set_order).map((s) => (
                  <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ width: 24, color: colors.muted, fontWeight: '700' }}>{s.set_order}</Text>
                    <Text style={{ flex: 1, fontSize: 20, fontWeight: '700' }}>{u.setOrReps(Number(s.weight), s.reps, we.exercises?.reps_only)}</Text>
                    <MaterialCommunityIcons
                      name={s.completed ? 'check-circle' : 'circle-outline'}
                      size={22}
                      color={s.completed ? colors.success : colors.muted}
                    />
                  </View>
                ))}
              </Card>
            ))}

            <Button mode="contained-tonal" icon="share-variant" onPress={() => setShareOpen(true)} contentStyle={{ height: 48 }} style={{ borderRadius: 16 }}>
              Share, export or send to a buddy
            </Button>
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
      {w && <ShareSheet visible={shareOpen} onClose={() => setShareOpen(false)} workout={w} />}
    </SafeAreaView>
  );
}

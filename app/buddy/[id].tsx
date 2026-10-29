import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, IconButton, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { buddyErrorMessage, fetchBuddyWorkouts } from '../../src/api/buddies';
import { Card, Empty, ErrorBanner, Stat } from '../../src/components/ui';
import { useUnits } from '../../src/hooks/useUnits';
import { formatDay, weekKey } from '../../src/lib/dates';
import { workoutTotals } from '../../src/lib/history';
import { buildShareCard } from '../../src/lib/shareCard';
import { colors, useScheme } from '../../src/theme';
import type { WorkoutRow } from '../../src/types';

/** A buddy's recent lifts. Read-only; the database only allows this while they share with you. */
export default function BuddyLifts() {
  useScheme();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const router = useRouter();
  const u = useUnits();
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const buddyName = name || 'Buddy';
  const back = () => (router.canGoBack() ? router.back() : router.replace('/buddies'));

  const load = useCallback(async () => {
    try {
      setError(null);
      setWorkouts(await fetchBuddyWorkouts(String(id)));
    } catch (e) {
      setError(buddyErrorMessage(e));
    } finally {
      setLoaded(true);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const week = useMemo(() => {
    const key = weekKey(new Date());
    const mine = workouts.filter((w) => w.completed_at && weekKey(new Date(w.completed_at)) === key);
    return { count: mine.length, volume: mine.reduce((s, w) => s + workoutTotals(w).volume, 0) };
  }, [workouts]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }}>
        <IconButton icon="arrow-left" onPress={back} accessibilityLabel="Back" />
        <Text variant="titleLarge" style={{ fontWeight: '800' }}>{buddyName}&apos;s lifts</Text>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.accent} />}
      >
        {!loaded && <ActivityIndicator color={colors.accent} />}
        {error && <ErrorBanner message={error} onRetry={load} />}
        {loaded && !error && workouts.length === 0 && (
          <Card>
            <Empty title={`Nothing to show yet`} hint={`${buddyName} hasn't logged a workout, or has stopped sharing with you.`} />
          </Card>
        )}
        {workouts.length > 0 && (
          <Card style={{ flexDirection: 'row', gap: 12 }}>
            <Stat label="This week" value={String(week.count)} unit="workouts" tint={colors.blue} />
            <Stat label="Weight lifted" value={u.vol(week.volume)} unit={u.label} />
          </Card>
        )}
        {workouts.map((w) => {
          const card = buildShareCard(w, u, '');
          return (
            <Card key={w.id} style={{ gap: 6 }}>
              <Text style={{ fontSize: 18, fontWeight: '800' }}>{w.name || 'Workout'}</Text>
              <Text style={{ color: colors.muted }}>{w.completed_at ? formatDay(w.completed_at) : ''}</Text>
              {card.rows.map((r, i) => (
                <View key={`${r.name}-${i}`}>
                  <Text style={{ fontWeight: '700' }}>{r.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 13 }}>{r.detail}</Text>
                </View>
              ))}
              <Text style={{ color: colors.accent, fontWeight: '800' }}>{card.total}</Text>
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, SectionList, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Chip, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Empty, ErrorBanner } from '../../src/components/ui';
import { useWorkouts } from '../../src/hooks/useWorkouts';
import { formatDay } from '../../src/lib/dates';
import { useUnits } from '../../src/hooks/useUnits';
import { exerciseNames, workoutTotals } from '../../src/lib/history';
import { colors } from '../../src/theme';

export default function History() {
  const router = useRouter();
  const { workouts, loading, error, refresh } = useWorkouts();
  const u = useUnits();
  const [filter, setFilter] = useState<string | null>(null);

  const names = useMemo(() => exerciseNames(workouts), [workouts]);
  const exerciseList = useMemo(
    () => [...names.entries()].sort((a, b) => a[1].localeCompare(b[1])),
    [names],
  );

  const sections = useMemo(() => {
    const list = filter
      ? workouts.filter((w) => w.workout_exercises.some((e) => e.exercise_id === filter))
      : workouts;
    const byDay = new Map<string, typeof list>();
    for (const w of list) {
      const day = formatDay(w.completed_at!);
      byDay.set(day, [...(byDay.get(day) ?? []), w]);
    }
    return [...byDay.entries()].map(([title, data]) => ({ title, data }));
  }, [workouts, filter]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Text style={{ fontSize: 30, fontWeight: '800', paddingHorizontal: 16, paddingTop: 8 }}>History</Text>
      <View style={{ height: 56 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 12, gap: 8 }}>
          <Chip selected={filter === null} onPress={() => setFilter(null)}>All</Chip>
          {exerciseList.map(([id, name]) => (
            <Chip key={id} selected={filter === id} onPress={() => setFilter(filter === id ? null : id)}>
              {name}
            </Chip>
          ))}
        </ScrollView>
      </View>

      {loading && <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />}
      {error && <View style={{ padding: 16 }}><ErrorBanner message={error} onRetry={refresh} /></View>}

      <SectionList
        sections={sections}
        keyExtractor={(w) => w.id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.accent} />}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text style={{ color: colors.muted, fontWeight: '700', marginTop: 8 }}>{section.title}</Text>
        )}
        renderItem={({ item: w }) => {
          const t = workoutTotals(w);
          const focus = filter ? w.workout_exercises.find((e) => e.exercise_id === filter) : null;
          return (
            <Pressable onPress={() => router.push({ pathname: '/workout/[id]', params: { id: w.id } })}>
              <Card style={{ gap: 4 }}>
                <Text style={{ fontSize: 18, fontWeight: '800' }}>{w.name ?? 'Workout'}</Text>
                {focus ? (
                  <Text style={{ color: colors.text }}>
                    {names.get(filter!)}: {[...focus.workout_sets].sort((a, b) => a.set_order - b.set_order)
                      .filter((s) => s.completed).map((s) => u.set(Number(s.weight), s.reps)).join(', ') || 'no completed sets'}
                  </Text>
                ) : (
                  <Text style={{ color: colors.muted }} numberOfLines={2}>
                    {w.workout_exercises.map((e) => e.exercises?.name).filter(Boolean).join(' · ')}
                  </Text>
                )}
                <Text style={{ color: colors.accent, fontWeight: '700' }}>
                  {t.sets} sets · {u.vol(t.volume)} {u.label}
                </Text>
              </Card>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          loading ? undefined : (
            <Empty
              title={filter ? 'No workouts with this exercise' : 'No workouts yet'}
              hint="Finished workouts will show up here."
            />
          )
        }
      />
    </SafeAreaView>
  );
}

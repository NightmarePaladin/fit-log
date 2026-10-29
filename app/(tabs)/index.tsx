import { useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Button, IconButton, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthProvider';
import { StatusBanner } from '../../src/components/StatusBanner';
import { Card, Empty, ErrorBanner, SectionTitle, Stat } from '../../src/components/ui';
import { useUnits } from '../../src/hooks/useUnits';
import { useWorkouts } from '../../src/hooks/useWorkouts';
import { formatDay, weekKey } from '../../src/lib/dates';
import { exerciseNames, exerciseRepsOnly, flattenWorkouts, workoutTotals } from '../../src/lib/history';
import { compareWeeks, detectPRs, fmtPct } from '../../src/lib/stats';
import { useDraftStore, useHasHydrated } from '../../src/store/draft';
import { GUEST } from '../../src/store/local';
import { colors, useScheme } from '../../src/theme';

export default function Dashboard() {
  useScheme(); // re-render when the appearance changes
  const router = useRouter();
  const { session, displayName, isGuest, exitOfflineMode } = useAuth();
  const { workouts, loading, error, refresh } = useWorkouts();
  const u = useUnits();
  const hydrated = useHasHydrated();
  const { draft, ownerId, start } = useDraftStore();
  const userId = session?.user.id ?? GUEST;
  const hasDraft = hydrated && !!draft && ownerId === userId;

  const data = useMemo(() => {
    const flat = flattenWorkouts(workouts);
    const names = exerciseNames(workouts);
    const thisWeek = weekKey(new Date());
    const weekWorkouts = workouts.filter((w) => w.completed_at && weekKey(new Date(w.completed_at)) === thisWeek);
    const weekVolume = weekWorkouts.reduce((sum, w) => sum + workoutTotals(w).volume, 0);
    const prs = detectPRs(flat).slice(0, 4);
    const exIds = [...new Set(flat.map((s) => s.exerciseId))];
    const summary = exIds
      .map((id) => ({ id, name: names.get(id) ?? 'Exercise', cmp: compareWeeks(flat, id) }))
      .filter((r) => r.cmp.previous.bestWeight != null && r.cmp.current.bestWeight != null);
    return { names, repsOnlyIds: exerciseRepsOnly(workouts), weekWorkouts, weekVolume, prs, summary, last: workouts[0] };
  }, [workouts]);

  const startWorkout = () => {
    if (!hasDraft) start(userId);
    router.push('/active');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.accent} />}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable
            onPress={() => (isGuest ? exitOfflineMode() : router.push('/account'))}
            accessibilityRole="button"
            accessibilityLabel={isGuest ? 'Sign in' : 'Open account'}
          >
            <Text style={{ color: colors.muted }}>{isGuest ? 'Not signed in. Tap to sign in' : 'Welcome back,'}</Text>
            <Text style={{ fontSize: 30, fontWeight: '800' }}>
              {displayName} <Text style={{ fontSize: 18, color: colors.accent }}>›</Text>
            </Text>
          </Pressable>
          <View style={{ flexDirection: 'row' }}>
            <IconButton icon="account-group" onPress={() => router.push('/buddies')} accessibilityLabel="Buddies" />
            <IconButton icon="cog" onPress={() => router.push('/settings')} accessibilityLabel="Settings" />
          </View>
        </View>

        <StatusBanner />

        <Button
          mode="contained"
          icon={hasDraft ? 'play' : 'plus'}
          onPress={startWorkout}
          contentStyle={{ height: 64 }}
          labelStyle={{ fontSize: 19, fontWeight: '800' }}
          style={{ borderRadius: 20 }}
        >
          {hasDraft ? 'Resume workout' : 'Start workout'}
        </Button>
        {hasDraft && (
          <Text style={{ color: colors.gold, textAlign: 'center', marginTop: -6 }}>
            You have an unfinished workout ({draft!.exercises.length} exercise{draft!.exercises.length === 1 ? '' : 's'})
          </Text>
        )}

        {error && <ErrorBanner message={error} onRetry={refresh} />}
        {loading && <ActivityIndicator color={colors.accent} />}

        <Card style={{ flexDirection: 'row', gap: 12 }}>
          <Stat label="This week" value={String(data.weekWorkouts.length)} unit="workouts" tint={colors.blue} />
          <Stat label="Weight lifted" value={u.vol(data.weekVolume)} unit={u.label} />
        </Card>

        <SectionTitle>Last workout</SectionTitle>
        {data.last ? (
          <Pressable onPress={() => router.push({ pathname: '/workout/[id]', params: { id: data.last.id } })}>
            <Card style={{ gap: 4 }}>
              <Text style={{ fontSize: 18, fontWeight: '800' }}>{data.last.name ?? 'Workout'}</Text>
              <Text style={{ color: colors.muted }}>{formatDay(data.last.completed_at!)}</Text>
              <Text style={{ color: colors.text, marginTop: 4 }}>
                {data.last.workout_exercises.map((e) => e.exercises?.name).filter(Boolean).join(' · ')}
              </Text>
              <Text style={{ color: colors.accent, marginTop: 4, fontWeight: '700' }}>
                {workoutTotals(data.last).volume > 0
                  ? `${u.vol(workoutTotals(data.last).volume)} ${u.label} total`
                  : `${workoutTotals(data.last).reps} reps total`}
              </Text>
            </Card>
          </Pressable>
        ) : (
          !loading && <Card><Empty title="No workouts yet" hint="Tap Start workout to log your first session." /></Card>
        )}

        <SectionTitle>Recent personal records</SectionTitle>
        {data.prs.length > 0 ? (
          <Card style={{ gap: 10 }}>
            {data.prs.map((pr) => (
              <View key={`${pr.workoutId}-${pr.exerciseId}-${pr.kind}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 22 }}>🏆</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700' }}>{data.names.get(pr.exerciseId) ?? 'Exercise'}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{formatDay(pr.completedAt)}</Text>
                </View>
                <Text style={{ color: colors.gold, fontWeight: '800', fontSize: 17 }}>
                  {u.setOrReps(pr.weight, pr.reps, data.repsOnlyIds.has(pr.exerciseId))}
                </Text>
              </View>
            ))}
          </Card>
        ) : (
          !loading && <Card><Empty title="No PRs yet" hint="Beat a previous weight or rep count to earn one." /></Card>
        )}

        <SectionTitle>Weekly strength progress</SectionTitle>
        {data.summary.length > 0 ? (
          <Card style={{ gap: 12 }}>
            {data.summary.slice(0, 5).map((r) => (
              <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700' }}>{r.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {data.repsOnlyIds.has(r.id)
                      ? `${r.cmp.previous.maxReps} → ${r.cmp.current.maxReps} reps (best set)`
                      : `${u.fmt(r.cmp.previous.bestWeight!)} → ${u.fmt(r.cmp.current.bestWeight!)} ${u.label}${
                          r.cmp.likeForLike ? ` at ${r.cmp.current.bestReps} reps` : ' (reps differ)'
                        }`}
                  </Text>
                </View>
                <Text
                  style={{
                    fontWeight: '800', fontSize: 16,
                    color: data.repsOnlyIds.has(r.id)
                      ? (r.cmp.repsDelta ?? 0) >= 0 ? colors.success : colors.danger
                      : r.cmp.strengthChangePct != null
                        ? r.cmp.strengthChangePct >= 0 ? colors.success : colors.danger
                        : colors.muted,
                  }}
                >
                  {data.repsOnlyIds.has(r.id)
                    ? `${(r.cmp.repsDelta ?? 0) > 0 ? '+' : ''}${r.cmp.repsDelta ?? 0} reps`
                    : r.cmp.strengthChangePct != null
                      ? fmtPct(r.cmp.strengthChangePct)
                      : `${(r.cmp.weightDelta ?? 0) > 0 ? '+' : ''}${u.fmt(r.cmp.weightDelta ?? 0)} ${u.label}`}
                </Text>
              </View>
            ))}
            <Button onPress={() => router.push('/progress')}>See full comparison</Button>
          </Card>
        ) : (
          !loading && (
            <Card>
              <Empty title="Nothing to compare yet" hint="Log the same lift in two consecutive weeks (Mon–Sun) to see progress." />
            </Card>
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native';
import { ActivityIndicator, Chip, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-gifted-charts';
import { StatusBanner } from '../../src/components/StatusBanner';
import { Card, Empty, ErrorBanner, SectionTitle } from '../../src/components/ui';
import { useUnits } from '../../src/hooks/useUnits';
import { useWorkouts } from '../../src/hooks/useWorkouts';
import { addWeeks, formatDay, startOfWeek } from '../../src/lib/dates';
import { exerciseNames, exerciseRepsOnly, exerciseTimed, flattenWorkouts } from '../../src/lib/history';
import { formatDuration } from '../../src/lib/units';
import { compareWeeks, detectPRs, fmtNum, fmtPct, weeklySeries } from '../../src/lib/stats';
import { colors, useScheme } from '../../src/theme';
import { PAGE_MAX_WIDTH, SHELL_MAX_WIDTH, pageWidth, useDesktop } from '../../src/lib/layout';

function Delta({ value, suffix = '', fmt }: { value: number | null; suffix?: string; fmt?: (n: number) => string }) {
  if (value == null) return <Text style={{ color: colors.muted, fontWeight: '800' }}>—</Text>;
  const color = value > 0 ? colors.success : value < 0 ? colors.danger : colors.muted;
  return (
    <Text style={{ color, fontWeight: '800', fontSize: 16 }}>
      {value > 0 ? '+' : value < 0 && fmt ? '-' : ''}
      {fmt ? fmt(Math.abs(value)) : +value.toFixed(2)}
      {suffix}
    </Text>
  );
}

function Pair({ label, prev, cur, unit, fmt = fmtNum }: { label: string; prev: number | null; cur: number | null; unit: string; fmt?: (n: number) => string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={{ color: colors.muted, fontSize: 12, textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ color: colors.muted, fontSize: 14 }}>Last week: {prev != null ? fmt(prev) : '—'} {prev != null && unit}</Text>
      <Text style={{ fontSize: 26, fontWeight: '800' }}>
        {cur != null ? fmt(cur) : '—'} <Text style={{ fontSize: 14, color: colors.muted }}>{cur != null && unit}</Text>
      </Text>
    </View>
  );
}

export default function Progress() {
  useScheme(); // re-render when the appearance changes
  const desktop = useDesktop();
  const { workouts, loading, error, refresh } = useWorkouts();
  const { width } = useWindowDimensions();
  const u = useUnits();
  const [selected, setSelected] = useState<string | null>(null); // null = all exercises

  const flat = useMemo(() => flattenWorkouts(workouts), [workouts]);
  const names = useMemo(() => exerciseNames(workouts), [workouts]);
  const exerciseList = useMemo(() => [...names.entries()].sort((a, b) => a[1].localeCompare(b[1])), [names]);
  const repsOnlyIds = useMemo(() => exerciseRepsOnly(workouts), [workouts]);
  const timedIds = useMemo(() => exerciseTimed(workouts), [workouts]);
  const effective = selected && names.has(selected) ? selected : null;
  /** a bodyweight exercise is selected: progress is measured in reps, not weight */
  const repsMode = !!effective && repsOnlyIds.has(effective);
  /** a timed exercise (running, plank): the "reps" are seconds, shown as m:ss */
  const timedMode = !!effective && timedIds.has(effective);

  const cmp = useMemo(() => compareWeeks(flat, effective), [flat, effective]);
  const series = useMemo(() => weeklySeries(flat, effective, 8), [flat, effective]);
  const prs = useMemo(
    () => detectPRs(flat).filter((p) => !effective || p.exerciseId === effective).slice(0, 6),
    [flat, effective],
  );

  const weekStart = startOfWeek(new Date());
  const range = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  // Desktop: the page is a centered column next to the sidebar, so size the chart from that, not the window.
  const pageW = desktop ? Math.min(PAGE_MAX_WIDTH, Math.min(width, SHELL_MAX_WIDTH) - 210) - 56 : width - 32;
  const chartWidth = pageW - 32 - 40;

  const toPoints = (key: 'bestWeight' | 'volume' | 'maxReps' | 'totalReps') =>
    series
      .filter((p) => p[key] != null && (key !== 'volume' || p.volume > 0) && (key !== 'totalReps' || p.totalReps > 0))
      .map((p) => ({ value: key === 'bestWeight' || key === 'volume' ? u.w(p[key] as number) : (p[key] as number), label: p.label }));
  const weightPts = repsMode ? toPoints('maxReps') : toPoints('bestWeight');
  const volumePts = repsMode ? toPoints('totalReps') : toPoints('volume');

  const chart = (pts: { value: number; label: string }[], color: string) => (
    <LineChart
      data={pts}
      width={chartWidth}
      height={150}
      color={color}
      thickness={3}
      dataPointsColor={color}
      dataPointsRadius={5}
      curved
      areaChart
      startFillColor={color}
      endFillColor={colors.card}
      startOpacity={0.25}
      endOpacity={0}
      yAxisTextStyle={{ color: colors.muted, fontSize: 10 }}
      xAxisLabelTextStyle={{ color: colors.muted, fontSize: 10 }}
      xAxisColor={colors.border}
      yAxisColor={colors.border}
      rulesColor={colors.border}
      hideRules={false}
      noOfSections={3}
      initialSpacing={16}
      spacing={Math.max(36, chartWidth / Math.max(pts.length, 2))}
      adjustToWidth
      isAnimated={false}
    />
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Text style={{ fontSize: 30, fontWeight: '800', paddingHorizontal: desktop ? 28 : 16, paddingTop: 8, ...pageWidth(desktop) }}>Progress</Text>
      <View style={{ paddingHorizontal: desktop ? 28 : 16, paddingTop: 8, ...pageWidth(desktop) }}>
        <StatusBanner />
      </View>
      <View style={{ height: 56, ...pageWidth(desktop) }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 12, gap: 8 }}>
          <Chip selected={effective === null} onPress={() => setSelected(null)}>All exercises</Chip>
          {exerciseList.map(([id, name]) => (
            <Chip key={id} selected={effective === id} onPress={() => setSelected(id)}>{name}</Chip>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: desktop ? 28 : 16, ...pageWidth(desktop), gap: 14, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.accent} />}
      >
        {loading && <ActivityIndicator color={colors.accent} />}
        {error && <ErrorBanner message={error} onRetry={refresh} />}

        {!loading && flat.length === 0 ? (
          <Card><Empty title="No data yet" hint="Save a few workouts across two weeks to compare them here." /></Card>
        ) : (
          <>
            <Text style={{ color: colors.muted }}>
              This week ({range(weekStart)}–{range(addWeeks(weekStart, 1))} excl.) vs last week. Weeks run Mon–Sun.
            </Text>

            {repsMode ? (
              <Card style={{ gap: 14 }}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Pair label={timedMode ? 'Longest' : 'Best set'} prev={cmp.previous.maxReps} cur={cmp.current.maxReps} unit={timedMode ? '' : 'reps'} fmt={timedMode ? formatDuration : undefined} />
                  <Pair label={timedMode ? 'Total time' : 'Total reps'} prev={cmp.previous.totalReps || null} cur={cmp.current.totalReps || null} unit={timedMode ? '' : 'reps'} fmt={timedMode ? formatDuration : undefined} />
                </View>
                <View style={{ height: 1, backgroundColor: colors.border }} />
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.muted, fontSize: 12, textTransform: 'uppercase' }}>{timedMode ? 'Longest change' : 'Best set change'}</Text>
                    <Delta value={cmp.repsDelta} suffix={timedMode ? '' : ' reps'} fmt={timedMode ? formatDuration : undefined} />
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{fmtPct(cmp.repsChangePct)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.muted, fontSize: 12, textTransform: 'uppercase' }}>{timedMode ? 'Total time change' : 'Total reps change'}</Text>
                    <Delta value={cmp.previous.totalReps > 0 ? cmp.totalRepsDelta : null} suffix={timedMode ? '' : ' reps'} fmt={timedMode ? formatDuration : undefined} />
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{fmtPct(cmp.totalRepsChangePct)}</Text>
                  </View>
                </View>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {timedMode
                    ? 'Timed exercise: progress is measured in time (minutes:seconds).'
                    : 'Bodyweight exercise: progress is measured in reps, not weight.'}
                </Text>
              </Card>
            ) : (
            <Card style={{ gap: 14 }}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {effective ? (
                  <Pair label="Best weight" prev={cmp.previous.bestWeight} cur={cmp.current.bestWeight} unit={u.label} fmt={u.fmt} />
                ) : (
                  <Pair label="Sets completed" prev={cmp.previous.setCount} cur={cmp.current.setCount} unit="" />
                )}
                <Pair label="Total volume" prev={cmp.previous.volume} cur={cmp.current.volume} unit={u.label} fmt={u.vol} />
              </View>
              <View style={{ height: 1, backgroundColor: colors.border }} />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {effective && (
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.muted, fontSize: 12, textTransform: 'uppercase' }}>Weight change</Text>
                    <Delta value={cmp.weightDelta == null ? null : u.w(cmp.weightDelta)} suffix={` ${u.label}`} />
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{fmtPct(cmp.weightChangePct)}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.muted, fontSize: 12, textTransform: 'uppercase' }}>Volume change</Text>
                  <Delta value={cmp.previous.volume > 0 ? Math.round(u.w(cmp.volumeDelta)) : null} suffix={` ${u.label}`} />
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{fmtPct(cmp.volumeChangePct)}</Text>
                </View>
              </View>
            </Card>
            )}

            {effective && !repsMode && (
              <Card
                style={{
                  gap: 6,
                  borderColor: cmp.likeForLike ? colors.success : colors.border,
                }}
              >
                <Text style={{ color: colors.muted, fontSize: 12, textTransform: 'uppercase' }}>Strength progression</Text>
                {cmp.likeForLike ? (
                  <Text style={{ fontSize: 28, fontWeight: '800', color: (cmp.strengthChangePct ?? 0) >= 0 ? colors.success : colors.danger }}>
                    {fmtPct(cmp.strengthChangePct)}
                  </Text>
                ) : (
                  <Text style={{ fontSize: 20, fontWeight: '800', color: colors.gold }}>Not comparable</Text>
                )}
                <Text style={{ color: colors.muted }}>{cmp.note}</Text>
                {cmp.previous.bestWeight != null && cmp.current.bestWeight != null && (
                  <Text style={{ color: colors.text }}>
                    {u.fmt(cmp.previous.bestWeight)} {u.label} × {cmp.previous.bestReps} → {u.fmt(cmp.current.bestWeight)} {u.label} × {cmp.current.bestReps}
                  </Text>
                )}
              </Card>
            )}

            <SectionTitle>
              {timedMode ? 'Longest time per week' : repsMode ? 'Best set (reps) per week' : effective ? 'Best weight per week' : 'Total volume per week'}
            </SectionTitle>
            <Card>
              {(effective ? weightPts : volumePts).length >= 2 ? (
                chart(effective ? weightPts : volumePts, colors.accent)
              ) : (
                <Empty title="Need 2+ weeks of data" hint="The chart appears once this is logged in at least two weeks." />
              )}
            </Card>

            {effective && (
              <>
                <SectionTitle>{timedMode ? 'Total time per week' : repsMode ? 'Total reps per week' : 'Total volume per week'}</SectionTitle>
                <Card>
                  {volumePts.length >= 2 ? (
                    chart(volumePts, colors.blue)
                  ) : (
                    <Empty title="Need 2+ weeks of data" />
                  )}
                </Card>
              </>
            )}

            <SectionTitle>Personal records</SectionTitle>
            <Card style={{ gap: 10 }}>
              {prs.length === 0 ? (
                <Empty title="No PRs yet" hint="Beat a previous best weight, or hit more reps at the same weight." />
              ) : (
                prs.map((pr) => (
                  <View key={`${pr.workoutId}-${pr.exerciseId}-${pr.kind}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ fontSize: 20 }}>🏆</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700' }}>{names.get(pr.exerciseId)}</Text>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        {formatDay(pr.completedAt)} · {pr.kind === 'weight' ? 'weight PR' : 'rep PR'}
                      </Text>
                    </View>
                    <Text style={{ color: colors.gold, fontWeight: '800', fontSize: 17 }}>
                      {u.setOrReps(pr.weight, pr.reps, timedIds.has(pr.exerciseId) ? 'time' : repsOnlyIds.has(pr.exerciseId))}
                    </Text>
                  </View>
                ))
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

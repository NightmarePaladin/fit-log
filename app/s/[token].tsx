import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Button, SegmentedButtons, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { fetchSharedWorkout, type SharedWorkout } from '../../src/api/sharing';
import { Card } from '../../src/components/ui';
import { formatDay } from '../../src/lib/dates';
import { isNetworkError } from '../../src/lib/net';
import { describeSets } from '../../src/lib/shareCard';
import { makeUnitFormat, repsModeOf, type Unit } from '../../src/lib/units';
import { colors, useScheme } from '../../src/theme';

/** Public page for a shared workout link. No account needed. */
export default function SharedWorkoutPage() {
  useScheme();
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const [workout, setWorkout] = useState<SharedWorkout | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [unit, setUnit] = useState<Unit>('lb');
  const u = makeUnitFormat(unit);

  useEffect(() => {
    let cancelled = false;
    fetchSharedWorkout(String(token))
      .then((w) => {
        if (cancelled) return;
        setWorkout(w);
        setState(w ? 'ready' : 'missing');
      })
      .catch((e) => {
        if (!cancelled) setState(isNetworkError(e) ? 'error' : 'missing');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40, maxWidth: 640, width: '100%', alignSelf: 'center' }}>
        <View style={{ alignItems: 'center', gap: 4, marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 30, fontWeight: '900' }}>Fit Lift</Text>
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons name="dumbbell" size={20} color="#fff" />
            </View>
          </View>
          <Text style={{ color: colors.muted }}>Log Lifts Fast</Text>
        </View>

        {state === 'loading' && <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />}

        {state === 'missing' && (
          <Card style={{ gap: 6 }}>
            <Text style={{ fontWeight: '800', fontSize: 18 }}>This link isn’t available</Text>
            <Text style={{ color: colors.muted }}>It may have been turned off, or the address is wrong.</Text>
          </Card>
        )}

        {state === 'error' && (
          <Card style={{ gap: 6 }}>
            <Text style={{ fontWeight: '800', fontSize: 18 }}>Couldn’t load this workout</Text>
            <Text style={{ color: colors.muted }}>Check your internet connection and try again.</Text>
          </Card>
        )}

        {state === 'ready' && workout && (
          <>
            <View>
              <Text style={{ fontSize: 24, fontWeight: '800' }}>{workout.name || 'Workout'}</Text>
              <Text style={{ color: colors.muted }}>
                {[workout.owner_name ? `Shared by ${workout.owner_name}` : 'Shared workout', workout.completed_at ? formatDay(workout.completed_at) : '']
                  .filter(Boolean)
                  .join('  ·  ')}
              </Text>
            </View>
            <SegmentedButtons
              value={unit}
              onValueChange={(v) => (v === 'lb' || v === 'kg') && setUnit(v)}
              buttons={[{ value: 'lb', label: 'lb' }, { value: 'kg', label: 'kg' }]}
            />
            {workout.exercises.map((ex, i) => (
              <Card key={`${ex.name}-${i}`} style={{ gap: 6 }}>
                <Text style={{ fontSize: 18, fontWeight: '800' }}>{ex.name}</Text>
                {ex.sets.map((s, j) => (
                  <View key={j} style={{ flexDirection: 'row', gap: 10 }}>
                    <Text style={{ width: 24, color: colors.muted, fontWeight: '700' }}>{j + 1}</Text>
                    <Text style={{ flex: 1, fontSize: 18, fontWeight: '700' }}>{u.setOrReps(Number(s.weight), s.reps, repsModeOf(ex))}</Text>
                    {!s.completed && <Text style={{ color: colors.muted }}>not completed</Text>}
                  </View>
                ))}
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {describeSets(ex.sets.map((s) => ({ weight: Number(s.weight), reps: s.reps, completed: s.completed })), repsModeOf(ex), u)}
                </Text>
              </Card>
            ))}
          </>
        )}

        <Button mode="contained" onPress={() => router.replace('/')} contentStyle={{ height: 50 }} style={{ marginTop: 6 }}>
          Track your own lifts with Fit Lift
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

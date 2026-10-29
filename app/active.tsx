import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Button, IconButton, Text } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { showDialog } from '../src/lib/dialog';
import { useAuth } from '../src/auth/AuthProvider';
import { StatusBanner } from '../src/components/StatusBanner';
import { finishWorkout } from '../src/lib/saveFlow';
import { ExercisePicker } from '../src/components/ExercisePicker';
import { Card } from '../src/components/ui';
import { useWorkouts } from '../src/hooks/useWorkouts';
import { useUnits } from '../src/hooks/useUnits';
import { previousByExercise, workoutToDraftExercises, type PrevSet } from '../src/lib/history';
import { useDraftStore } from '../src/store/draft';
import { colors, getScheme, useScheme } from '../src/theme';
import type { DraftExercise, Exercise } from '../src/types';

const makeInput = () => ({
  backgroundColor: colors.cardAlt,
  color: colors.text,
  borderRadius: 12,
  height: 48,
  minWidth: 72,
  textAlign: 'center' as const,
  fontSize: 20,
  fontWeight: '700' as const,
});

export default function ActiveWorkout() {
  useScheme(); // re-render when the appearance changes
  const router = useRouter();
  const store = useDraftStore();
  const { draft } = store;
  const { workouts } = useWorkouts();
  const u = useUnits();
  const { session } = useAuth();
  const { bottom } = useSafeAreaInsets(); // keeps the save bar above Android's gesture/nav bar
  const [picker, setPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prev = useMemo(
    () => previousByExercise(workouts, draft?.editingWorkoutId),
    [workouts, draft?.editingWorkoutId],
  );
  const lastWorkout = workouts.find((w) => w.id !== draft?.editingWorkoutId);

  if (!draft) return <Redirect href="/" />;

  const onPick = (ex: Exercise) => {
    store.addExercise(ex.id, ex.name, prev.get(ex.id)?.length ?? 3, !!ex.reps_only);
    setPicker(false);
  };

  const copyLast = () => {
    if (!lastWorkout) return;
    const exs = workoutToDraftExercises(lastWorkout, false, u.unit);
    useDraftStore.setState({ draft: { ...draft, exercises: [...draft.exercises, ...exs] } });
  };

  const doSave = async (markAll: boolean) => {
    let toSave = draft;
    if (markAll) {
      toSave = {
        ...draft,
        exercises: draft.exercises.map((e) => ({
          ...e,
          sets: e.sets.map((s) => (Number(s.reps) > 0 ? { ...s, completed: true } : s)),
        })),
      };
    }
    setSaving(true);
    setError(null);
    try {
      // Signed in and online: uploaded now. No connection, or no account: kept on this device to upload later.
      const { id, status } = await finishWorkout(toSave, u.unit, session?.user.id ?? null);
      router.replace({ pathname: '/workout/[id]', params: { id, saved: status === 'queued' ? 'queued' : '1' } });
      store.discard();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save workout. Your draft is still here.');
    } finally {
      setSaving(false);
    }
  };

  const finish = () => {
    const unmarked = draft.exercises.flatMap((e) => e.sets).filter((s) => !s.completed && Number(s.reps) > 0).length;
    const completed = draft.exercises.flatMap((e) => e.sets).filter((s) => s.completed).length;
    if (unmarked > 0) {
      showDialog('Some sets aren’t checked off', `${unmarked} set${unmarked > 1 ? 's have' : ' has'} reps but ${unmarked > 1 ? 'aren’t' : 'isn’t'} marked complete. Only completed sets count toward volume and PRs.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save as is', onPress: () => doSave(false) },
        { text: 'Mark all & save', onPress: () => doSave(true) },
      ]);
    } else if (completed === 0) {
      setError('Mark at least one set complete before saving.');
    } else {
      doSave(false);
    }
  };

  const discard = () =>
    showDialog('Discard workout?', 'This deletes the unsaved draft.', [
      { text: 'Keep going', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          store.discard();
          router.replace('/');
        },
      },
    ]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4 }}>
        <IconButton icon="chevron-down" onPress={() => router.back()} accessibilityLabel="Minimize (draft stays saved)" />
        <Text variant="titleLarge" style={{ flex: 1, fontWeight: '800' }}>
          {draft.editingWorkoutId ? 'Edit workout' : 'Workout'}
        </Text>
        <Button textColor={colors.danger} onPress={discard}>Discard</Button>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 160 + bottom }} keyboardShouldPersistTaps="handled">
        <StatusBanner />
        {draft.exercises.length === 0 && (
          <Card style={{ alignItems: 'center', gap: 12 }}>
            <MaterialCommunityIcons name="dumbbell" size={40} color={colors.accent} />
            <Text style={{ color: colors.muted, textAlign: 'center' }}>
              Add your first exercise, or start from your last workout.
            </Text>
            {lastWorkout && (
              <Button mode="contained-tonal" icon="content-copy" onPress={copyLast}>
                Copy last workout{lastWorkout.name ? ` (${lastWorkout.name})` : ''}
              </Button>
            )}
          </Card>
        )}

        {draft.exercises.map((ex) => (
          <ExerciseCard key={ex.key} ex={ex} prev={prev.get(ex.exerciseId) ?? []} />
        ))}

        <Button mode="outlined" icon="plus" onPress={() => setPicker(true)} contentStyle={{ height: 52 }} style={{ borderRadius: 16 }}>
          Add exercise
        </Button>
        {draft.exercises.length > 0 && lastWorkout && (
          <Button icon="content-copy" onPress={copyLast}>Append last workout</Button>
        )}
      </ScrollView>

      <View
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 16 + bottom, gap: 8,
          backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border,
        }}
      >
        {error && <Text style={{ color: colors.danger, textAlign: 'center' }}>{error}</Text>}
        <Button
          mode="contained"
          icon="check"
          loading={saving}
          disabled={saving || draft.exercises.length === 0}
          onPress={finish}
          contentStyle={{ height: 56 }}
          labelStyle={{ fontSize: 17, fontWeight: '800' }}
          style={{ borderRadius: 16 }}
        >
          {draft.editingWorkoutId ? 'Save changes' : 'Finish & save'}
        </Button>
      </View>

      <ExercisePicker visible={picker} onClose={() => setPicker(false)} onPick={onPick} />
    </SafeAreaView>
  );
}

function ExerciseCard({ ex, prev }: { ex: DraftExercise; prev: PrevSet[] }) {
  const input = makeInput();
  const { addSet, removeSet, updateSet, removeExercise } = useDraftStore();
  const u = useUnits();
  const confirmRemove = () =>
    showDialog(`Remove ${ex.name}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeExercise(ex.key) },
    ]);

  return (
    <Card style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ flex: 1, fontSize: 19, fontWeight: '800' }}>{ex.name}</Text>
        <IconButton icon="delete-outline" size={22} onPress={confirmRemove} accessibilityLabel={`Remove ${ex.name}`} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ width: 24, color: colors.muted, fontSize: 12 }}>SET</Text>
        <Text style={{ width: 96, color: colors.muted, fontSize: 12 }}>LAST WORKOUT</Text>
        <Text style={{ flex: 1, color: colors.muted, fontSize: 12, textAlign: 'center' }}>
          {ex.repsOnly ? 'TODAY  (REPS)' : `TODAY  (${u.label.toUpperCase()} × REPS)`}
        </Text>
      </View>

      {ex.sets.map((s, i) => {
        const p = prev[i];
        return (
          <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: s.completed ? 0.75 : 1 }}>
            <Text style={{ width: 24, fontSize: 16, fontWeight: '700', color: colors.muted }}>{i + 1}</Text>
            <Pressable
              disabled={!p}
              onPress={() =>
                p && updateSet(ex.key, s.key, { weight: ex.repsOnly ? '' : u.fmt(p.weight), reps: String(p.reps) })
              }
              accessibilityLabel={p ? `Copy previous set ${u.setOrReps(p.weight, p.reps, ex.repsOnly)}` : 'No previous set'}
              style={{
                width: 96, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
                flexDirection: 'row', gap: 4, borderWidth: 1, borderColor: p ? colors.accent : colors.border,
              }}
            >
              <Text style={{ color: p ? colors.text : colors.muted, fontSize: 13, fontWeight: '600' }}>
                {p ? u.setOrReps(p.weight, p.reps, ex.repsOnly) : '—'}
              </Text>
              {p && <MaterialCommunityIcons name="arrow-right-bold" size={13} color={colors.accent} />}
            </Pressable>
            <View style={{ flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
              {!ex.repsOnly && (
                <>
                  <TextInput
                    style={input}
                    value={s.weight}
                    onChangeText={(t) => updateSet(ex.key, s.key, { weight: t.replace(/[^0-9.]/g, '') })}
                    keyboardType="decimal-pad"
                    placeholder={u.label}
                    placeholderTextColor={colors.muted}
                    selectTextOnFocus
                    accessibilityLabel={`Set ${i + 1} weight`}
                  />
                  <Text style={{ color: colors.muted, fontSize: 18 }}>×</Text>
                </>
              )}
              <TextInput
                style={[input, { minWidth: ex.repsOnly ? 120 : 56 }]}
                value={s.reps}
                onChangeText={(t) => updateSet(ex.key, s.key, { reps: t.replace(/[^0-9]/g, '') })}
                keyboardType="number-pad"
                placeholder="reps"
                placeholderTextColor={colors.muted}
                selectTextOnFocus
                accessibilityLabel={`Set ${i + 1} reps`}
              />
            </View>
            <Pressable
              onPress={() => updateSet(ex.key, s.key, { completed: !s.completed })}
              onLongPress={() => ex.sets.length > 1 && removeSet(ex.key, s.key)}
              accessibilityLabel={`Mark set ${i + 1} complete`}
              style={{
                width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
                backgroundColor: s.completed ? colors.success : colors.cardAlt,
              }}
            >
              <MaterialCommunityIcons name="check" size={26} color={s.completed ? (getScheme() === 'light' ? '#FFFFFF' : '#0B1F17') : colors.muted} />
            </Pressable>
          </View>
        );
      })}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Button icon="plus" onPress={() => addSet(ex.key)}>Add set</Button>
        {ex.sets.length > 1 && (
          <Button
            textColor={colors.muted}
            icon="minus"
            onPress={() => removeSet(ex.key, ex.sets[ex.sets.length - 1].key)}
          >
            Remove set
          </Button>
        )}
      </View>
    </Card>
  );
}

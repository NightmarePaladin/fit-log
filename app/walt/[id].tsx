import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Button, IconButton, Text } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { endSession, leaveSession, markFinished } from '../../src/api/walt';
import { useAuth } from '../../src/auth/AuthProvider';
import { ExercisePicker } from '../../src/components/ExercisePicker';
import { Card } from '../../src/components/ui';
import { useUnits } from '../../src/hooks/useUnits';
import { useWaltSession } from '../../src/hooks/useWaltSession';
import { shareBaseUrl } from '../../src/lib/config';
import { showDialog } from '../../src/lib/dialog';
import { createCustomExercise, loadExercises } from '../../src/lib/exercises';
import { pageWidth, useDesktop } from '../../src/lib/layout';
import { finishWorkout } from '../../src/lib/saveFlow';
import { copyText, shareText } from '../../src/lib/shareOut';
import {
  buildWaltDraft, describeWaltSets, modeOfExercise, setsOf, waltErrorMessage, type EditSet, type WaltExercise,
} from '../../src/lib/walt';
import { colors, useScheme } from '../../src/theme';
import type { Exercise } from '../../src/types';

const makeInput = () => ({
  backgroundColor: colors.cardAlt,
  color: colors.text,
  borderRadius: 12,
  height: 48,
  minWidth: 64,
  textAlign: 'center' as const,
  fontSize: 20,
  fontWeight: '700' as const,
});

/** The live session: one shared exercise list, my own sets, and everyone else's sets updating as they log them. */
export default function WaltSession() {
  useScheme(); // re-render when the appearance changes
  const desktop = useDesktop();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, unit } = useAuth();
  const me = session?.user.id ?? '';
  const u = useUnits();
  const { bottom } = useSafeAreaInsets();
  const w = useWaltSession(String(id), me, unit);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/walt'));

  const snap = w.snap;
  const isHost = !!snap && snap.session.host_id === me;
  const ended = snap?.session.status === 'ended';
  const myMember = snap?.members.find((m) => m.user_id === me);

  const run = async (fn: () => Promise<void>) => {
    setNote(null);
    try {
      await fn();
    } catch (e) {
      setNote({ ok: false, text: waltErrorMessage(e) });
    }
  };

  const onPick = (ex: Exercise) => {
    setPicker(false);
    run(() => w.addExercise({ name: ex.name, mode: modeOfExercise(ex), exerciseId: ex.is_custom ? null : ex.id }));
  };

  const invite = () =>
    snap
      ? `Lift with me on Fit Log W.A.L.T. (We All Lift Together)! Open W.A.L.T., tap Join, and enter this code: ${snap.session.code}  ${shareBaseUrl()}`
      : '';

  /** Save MY sets as a normal workout in MY history, same as a workout I logged alone. */
  const finish = async () => {
    if (!snap) return;
    setBusy(true);
    setNote(null);
    try {
      await w.flush().catch(() => {}); // a hiccup syncing to the others must not stop me saving my own workout
      const used = snap.exercises.filter((ex) => (w.mine[ex.id] ?? []).some((s) => s.completed || Number(s.reps) > 0));
      if (used.length === 0) throw new Error('Log at least one set first.');

      // Built-in exercises are shared by id. Custom ones are matched by name in my own list, or created there.
      const { exercises: all } = await loadExercises(me);
      const ids = new Map<string, string>();
      for (const ex of used) {
        if (ex.exercise_id) {
          ids.set(ex.id, ex.exercise_id);
          continue;
        }
        const found = all.find((e) => e.name.toLowerCase() === ex.name.toLowerCase());
        if (found) {
          ids.set(ex.id, found.id);
        } else {
          const created = await createCustomExercise(ex.name, me, all, ex.mode === 'time' ? 'time' : ex.mode === 'reps');
          all.push(created);
          ids.set(ex.id, created.id);
        }
      }
      const draft = buildWaltDraft(snap.session.name, snap.session.created_at, snap.exercises, w.mine, ids);
      const { id: workoutId, status } = await finishWorkout(draft, unit, me);
      markFinished(snap.session.id, me).catch(() => {});
      router.replace({ pathname: '/workout/[id]', params: { id: workoutId, saved: status === 'queued' ? 'queued' : '1' } });
    } catch (e) {
      setNote({ ok: false, text: waltErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const confirmFinish = () =>
    myMember?.finished_at
      ? showDialog('Save another copy?', 'You already saved your workout from this session. Saving again adds a second copy to your history.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save again', onPress: finish },
        ])
      : finish();

  const confirmEnd = () =>
    showDialog('End for everyone?', 'Nobody can log more sets. Everyone can still save their own workout.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End session', style: 'destructive', onPress: () => run(() => endSession(String(id)).then(w.refresh)) },
    ]);

  const confirmLeave = () =>
    showDialog('Leave this session?', 'Your sets in it are removed. Your own workout history is not touched.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => run(() => leaveSession(String(id)).then(() => router.replace('/walt'))) },
    ]);

  if (w.loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  if (!snap) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: 'center', gap: 12 }}>
        <Text variant="titleLarge" style={{ fontWeight: '800' }}>Couldn’t open this session</Text>
        <Text style={{ color: colors.muted }}>{w.error ?? 'It may have ended, or you are no longer in it.'}</Text>
        <Button mode="contained" onPress={w.refresh}>Try again</Button>
        <Button onPress={back}>Back</Button>
      </SafeAreaView>
    );
  }

  const others = snap.members.filter((m) => m.user_id !== me);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }}>
        <IconButton icon="arrow-left" onPress={back} accessibilityLabel="Back" />
        <View style={{ flex: 1 }}>
          <Text variant="titleLarge" style={{ fontWeight: '800' }} numberOfLines={1}>{snap.session.name}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>W.A.L.T.  ·  We All Lift Together</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: desktop ? 28 : 16, gap: 14, paddingBottom: 190 + bottom, ...pageWidth(desktop) }}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <View>
              <Text style={{ color: colors.muted, fontSize: 12 }}>JOIN CODE</Text>
              <Text selectable style={{ fontSize: 28, fontWeight: '900', letterSpacing: 3, color: colors.accent }}>{snap.session.code}</Text>
            </View>
            <View style={{ flexDirection: 'row' }}>
              <IconButton
                icon="content-copy"
                accessibilityLabel="Copy code"
                onPress={() => copyText(snap.session.code).then(() => setNote({ ok: true, text: 'Code copied.' }))}
              />
              <IconButton icon="share-variant" accessibilityLabel="Send invite" onPress={() => shareText(invite()).catch(() => {})} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {snap.members.map((m) => (
              <View
                key={m.user_id}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5,
                  borderRadius: 14, backgroundColor: colors.cardAlt,
                }}
              >
                <MaterialCommunityIcons name={m.finished_at ? 'check-circle' : 'account'} size={16} color={m.finished_at ? colors.success : colors.muted} />
                <Text style={{ fontWeight: '700' }}>{m.user_id === me ? `${m.display_name} (you)` : m.display_name}</Text>
              </View>
            ))}
            <Text style={{ color: colors.muted, alignSelf: 'center', fontSize: 12 }}>{snap.members.length} of 4</Text>
          </View>
        </Card>

        {ended && (
          <Card style={{ borderColor: colors.gold }}>
            <Text style={{ color: colors.gold, fontWeight: '700' }}>This session has ended.</Text>
            <Text style={{ color: colors.muted }}>No more sets can be logged. You can still save your own workout below.</Text>
          </Card>
        )}
        {w.syncError && !ended && (
          <Text style={{ color: colors.gold }}>Having trouble syncing. Your sets are safe on this device and will be sent again.</Text>
        )}
        {w.error && <Text style={{ color: colors.danger }}>{w.error}</Text>}
        {note && <Text style={{ color: note.ok ? colors.success : colors.danger }}>{note.text}</Text>}

        {snap.exercises.length === 0 && (
          <Card style={{ alignItems: 'center', gap: 8 }}>
            <MaterialCommunityIcons name="dumbbell" size={36} color={colors.accent} />
            <Text style={{ color: colors.muted, textAlign: 'center' }}>
              Add the first exercise. Everyone in the session sees it and logs their own sets.
            </Text>
          </Card>
        )}

        {snap.exercises.map((ex) => (
          <ExerciseBlock
            key={ex.id}
            ex={ex}
            mine={w.mine[ex.id] ?? []}
            canRemove={!ended && (ex.added_by === me || isHost)}
            locked={ended}
            others={others.map((m) => ({
              id: m.user_id,
              name: m.display_name,
              sets: describeWaltSets(setsOf(snap.sets, ex.id, m.user_id), ex.mode, u),
            }))}
            onUpdate={(setId, patch) => w.updateSet(ex.id, setId, patch)}
            onAddSet={() => w.addSet(ex.id)}
            onRemoveSet={(setId) => w.removeSet(ex.id, setId)}
            onRemove={() =>
              showDialog(`Remove ${ex.name}?`, 'It disappears for everyone, along with everyone’s sets for it.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => run(() => w.removeExercise(ex.id)) },
              ])
            }
          />
        ))}

        {!ended && (
          <Button mode="outlined" icon="plus" onPress={() => setPicker(true)} contentStyle={{ height: 52 }} style={{ borderRadius: 16 }}>
            Add exercise
          </Button>
        )}
      </ScrollView>

      <View
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 16 + bottom, gap: 6,
          backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border,
        }}
      >
        <View style={{ width: '100%', gap: 6, ...pageWidth(desktop) }}>
          <Button
            mode="contained"
            icon="check"
            loading={busy}
            disabled={busy || snap.exercises.length === 0}
            onPress={confirmFinish}
            contentStyle={{ height: 56 }}
            labelStyle={{ fontSize: 17, fontWeight: '800' }}
            style={{ borderRadius: 16 }}
          >
            {myMember?.finished_at ? 'Save my workout again' : 'Finish & save my workout'}
          </Button>
          {isHost ? (
            !ended && <Button textColor={colors.danger} onPress={confirmEnd}>End session for everyone</Button>
          ) : (
            <Button textColor={colors.muted} onPress={confirmLeave}>Leave session</Button>
          )}
        </View>
      </View>

      <ExercisePicker visible={picker} onClose={() => setPicker(false)} onPick={onPick} />
    </SafeAreaView>
  );
}

function ExerciseBlock({
  ex, mine, others, canRemove, locked, onUpdate, onAddSet, onRemoveSet, onRemove,
}: {
  ex: WaltExercise;
  mine: EditSet[];
  others: { id: string; name: string; sets: { text: string; done: boolean }[] }[];
  canRemove: boolean;
  locked: boolean;
  onUpdate: (setId: string, patch: Partial<Omit<EditSet, 'id'>>) => void;
  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
  onRemove: () => void;
}) {
  const u = useUnits();
  const input = makeInput();
  const timed = ex.mode === 'time';
  const hasWeight = ex.mode === 'weight';
  const sec = (s: EditSet) => Number(s.reps) || 0;

  return (
    <Card style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 19, fontWeight: '800' }}>{ex.name}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {timed ? 'Timed' : hasWeight ? `${u.label.toUpperCase()} × REPS` : 'Reps only'}
          </Text>
        </View>
        {canRemove && <IconButton icon="delete-outline" size={22} onPress={onRemove} accessibilityLabel={`Remove ${ex.name}`} />}
      </View>

      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>YOU</Text>
      {mine.map((s, i) => (
        <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: s.completed ? 0.75 : 1 }}>
          <Text style={{ width: 22, fontSize: 16, fontWeight: '700', color: colors.muted }}>{i + 1}</Text>
          <View style={{ flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
            {hasWeight && (
              <>
                <TextInput
                  style={input}
                  value={s.weight}
                  editable={!locked}
                  onChangeText={(t) => onUpdate(s.id, { weight: t.replace(/[^0-9.]/g, '') })}
                  keyboardType="decimal-pad"
                  placeholder={u.label}
                  placeholderTextColor={colors.muted}
                  selectTextOnFocus
                  accessibilityLabel={`Set ${i + 1} weight`}
                />
                <Text style={{ color: colors.muted, fontSize: 18 }}>×</Text>
              </>
            )}
            {timed ? (
              <>
                <TextInput
                  style={[input, { minWidth: 56, width: 56, paddingHorizontal: 0 }]}
                  value={s.reps === '' ? '' : String(Math.floor(sec(s) / 60))}
                  editable={!locked}
                  onChangeText={(t) => {
                    const m = t.replace(/[^0-9]/g, '');
                    const total = (Number(m) || 0) * 60 + (sec(s) % 60);
                    onUpdate(s.id, { reps: m === '' && total === 0 ? '' : String(total) });
                  }}
                  keyboardType="number-pad"
                  placeholder="min"
                  placeholderTextColor={colors.muted}
                  selectTextOnFocus
                  accessibilityLabel={`Set ${i + 1} minutes`}
                />
                <Text style={{ color: colors.muted, fontSize: 18 }}>:</Text>
                <TextInput
                  style={[input, { minWidth: 56, width: 56, paddingHorizontal: 0 }]}
                  value={s.reps === '' ? '' : String(sec(s) % 60).padStart(2, '0')}
                  editable={!locked}
                  onChangeText={(t) => {
                    const ss = t.replace(/[^0-9]/g, '').slice(-3);
                    const total = Math.floor(sec(s) / 60) * 60 + (Number(ss) || 0);
                    onUpdate(s.id, { reps: ss === '' && total === 0 ? '' : String(total) });
                  }}
                  keyboardType="number-pad"
                  placeholder="sec"
                  placeholderTextColor={colors.muted}
                  selectTextOnFocus
                  accessibilityLabel={`Set ${i + 1} seconds`}
                />
              </>
            ) : (
              <TextInput
                style={[input, { minWidth: hasWeight ? 64 : 120 }]}
                value={s.reps}
                editable={!locked}
                onChangeText={(t) => onUpdate(s.id, { reps: t.replace(/[^0-9]/g, '') })}
                keyboardType="number-pad"
                placeholder="reps"
                placeholderTextColor={colors.muted}
                selectTextOnFocus
                accessibilityLabel={`Set ${i + 1} reps`}
              />
            )}
          </View>
          <Pressable
            disabled={locked}
            onPress={() => onUpdate(s.id, { completed: !s.completed })}
            onLongPress={() => mine.length > 1 && onRemoveSet(s.id)}
            accessibilityLabel={`Mark set ${i + 1} complete`}
            style={{
              width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
              backgroundColor: s.completed ? colors.success : colors.cardAlt,
            }}
          >
            <MaterialCommunityIcons name="check" size={26} color={s.completed ? '#0B1F17' : colors.muted} />
          </Pressable>
        </View>
      ))}
      {!locked && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Button icon="plus" onPress={onAddSet}>Add set</Button>
          {mine.length > 1 && (
            <Button textColor={colors.muted} icon="minus" onPress={() => onRemoveSet(mine[mine.length - 1].id)}>Remove set</Button>
          )}
        </View>
      )}

      {others.length > 0 && <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 2 }} />}
      {others.map((o) => (
        <View key={o.id} style={{ gap: 4 }}>
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>{o.name.toUpperCase()}</Text>
          {o.sets.length === 0 ? (
            <Text style={{ color: colors.muted }}>No sets yet</Text>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {o.sets.map((s, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4,
                    borderRadius: 12, backgroundColor: colors.cardAlt, opacity: s.done ? 1 : 0.55,
                  }}
                >
                  {s.done && <MaterialCommunityIcons name="check" size={14} color={colors.success} />}
                  <Text style={{ fontWeight: '700' }}>{s.text}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ))}
    </Card>
  );
}

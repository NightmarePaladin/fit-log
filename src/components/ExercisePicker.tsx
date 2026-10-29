import { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, View } from 'react-native';
import { ResponsiveModal } from './ResponsiveModal';
import { ActivityIndicator, Button, IconButton, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { searchWger, WGER_ATTRIBUTION, type WgerExercise } from '../api/wger';
import { useAuth } from '../auth/AuthProvider';
import { showDialog } from '../lib/dialog';
import { createCustomExercise, deleteCustomExercise, loadExercises } from '../lib/exercises';
import { colors, useScheme } from '../theme';
import type { Exercise } from '../types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onPick: (exercise: Exercise) => void;
};

export function ExercisePicker({ visible, onClose, onPick }: Props) {
  return (
    <ResponsiveModal visible={visible} onClose={onClose}>
      {/* Mounted only while open, so search/error/loading state resets on every open. */}
      {visible ? <PickerBody onClose={onClose} onPick={onPick} /> : null}
    </ResponsiveModal>
  );
}

function PickerBody({ onClose, onPick }: Omit<Props, 'visible'>) {
  const scheme = useScheme();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [all, setAll] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  // "Create custom exercise" form
  const [formOpen, setFormOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [kind, setKind] = useState<'weight' | 'reps' | 'time'>('weight');
  const [creating, setCreating] = useState(false);

  // Results from the free wger exercise library (shown under your own list once you type 3+ letters)
  const [lib, setLib] = useState<{ term: string; items: WgerExercise[]; failed: boolean } | null>(null);

  useEffect(() => {
    // Works with no connection: falls back to the built-in library plus custom exercises saved on this device.
    loadExercises(userId)
      .then((r) => {
        setAll(r.exercises);
        setOffline(r.offline);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load exercises'))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 3 || offline) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      searchWger(term, ctrl.signal)
        .then((items) => setLib({ term, items, failed: false }))
        .catch(() => {
          if (!ctrl.signal.aborted) setLib({ term, items: [], failed: true });
        });
    }, 450); // wait for a pause in typing
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, offline]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? all.filter((e) => e.name.toLowerCase().includes(q)) : all;
  }, [all, query]);

  const typed = query.trim();
  const exactMatch = all.some((e) => e.name.toLowerCase() === typed.toLowerCase());
  const libTerm = typed.length >= 3 && !offline ? typed : null;
  const libLoading = libTerm !== null && lib?.term !== libTerm;
  const taken = new Set(all.map((e) => e.name.toLowerCase()));
  const libItems = libTerm !== null && lib?.term === libTerm ? lib.items.filter((i) => !taken.has(i.name.toLowerCase())) : [];

  const openForm = () => {
    setNewName(typed);
    setKind('weight');
    setError(null);
    setFormOpen(true);
  };

  const create = async () => {
    setCreating(true);
    setError(null);
    try {
      onPick(await createCustomExercise(newName, userId, all, kind === 'time' ? 'time' : kind === 'reps'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create exercise');
    } finally {
      setCreating(false);
    }
  };

  /** Adding a library exercise saves it as one of your own (so it also works offline and in history) and picks it. */
  const addFromLibrary = async (item: WgerExercise) => {
    setCreating(true);
    setError(null);
    try {
      onPick(await createCustomExercise(item.name, userId, all, item.mode, item.muscleGroup));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add exercise');
    } finally {
      setCreating(false);
    }
  };

  const confirmDelete = (ex: Exercise) =>
    showDialog(`Delete “${ex.name}”?`, 'This removes it from your exercise list. It can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setError(null);
          try {
            await deleteCustomExercise(ex, userId);
            setAll((list) => list.filter((e) => e.id !== ex.id));
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not delete exercise');
          }
        },
      },
    ]);

  const librarySection =
    libTerm === null ? null : (
      <View style={{ paddingTop: 8, paddingBottom: 32 }}>
        <Text style={{ paddingHorizontal: 20, paddingVertical: 8, fontWeight: '800', color: colors.muted, fontSize: 13, letterSpacing: 0.5 }}>
          EXERCISE LIBRARY
        </Text>
        {libLoading ? (
          <ActivityIndicator color={colors.accent} style={{ margin: 12 }} />
        ) : lib?.failed ? (
          <Text style={{ paddingHorizontal: 20, color: colors.muted }}>Couldn’t reach the exercise library. Check your connection.</Text>
        ) : libItems.length === 0 ? (
          <Text style={{ paddingHorizontal: 20, color: colors.muted }}>No more matches in the library.</Text>
        ) : (
          libItems.map((item) => (
            <Pressable
              key={item.id}
              disabled={creating}
              onPress={() => addFromLibrary(item)}
              android_ripple={{ color: colors.cardAlt }}
              accessibilityLabel={`Add ${item.name} from the exercise library`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, opacity: creating ? 0.5 : 1 }}
            >
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: '#fff' }} />
              ) : (
                <View style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: colors.cardAlt }} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '600' }}>{item.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  {[item.muscles.slice(0, 2).join(', ') || item.muscleGroup, item.equipment.slice(0, 2).join(', ')].filter(Boolean).join('  ·  ')}
                  {item.mode === 'time' ? '  ·  Timed' : item.mode ? '  ·  Reps only' : ''}
                </Text>
              </View>
              <Text style={{ color: colors.accent, fontWeight: '700' }}>Add</Text>
            </Pressable>
          ))
        )}
        <Text style={{ paddingHorizontal: 20, paddingTop: 10, color: colors.muted, fontSize: 11 }}>{WGER_ATTRIBUTION}</Text>
      </View>
    );

  return (
    <>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ padding: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="titleLarge" style={{ fontWeight: '800' }}>Add exercise</Text>
            <Button onPress={onClose}>Close</Button>
          </View>
          {offline && (
            <Text style={{ color: colors.gold, fontSize: 12 }}>
              Offline: showing the built-in library. New custom exercises are saved on this device.
            </Text>
          )}
          <TextInput
            mode="outlined"
            placeholder="Search or create an exercise"
            value={query}
            onChangeText={setQuery}
            autoFocus={!formOpen}
            left={<TextInput.Icon icon="magnify" />}
          />

          {formOpen ? (
            <View
              style={{ gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.accent }}
            >
              <Text style={{ fontWeight: '800', fontSize: 16 }}>New custom exercise</Text>
              <TextInput mode="outlined" label="Exercise name" value={newName} onChangeText={setNewName} autoFocus maxLength={80} />
              <SegmentedButtons
                value={kind}
                onValueChange={(v) => (v === 'weight' || v === 'reps' || v === 'time') && setKind(v)}
                buttons={[
                  { value: 'weight', label: 'Weight', icon: 'weight-lifter' },
                  { value: 'reps', label: 'Reps', icon: 'human-handsup' },
                  { value: 'time', label: 'Timed', icon: 'timer-outline' },
                ]}
              />
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {kind === 'time'
                  ? 'For running, planks, rowing or anything you time: you log minutes and seconds, no weight or reps.'
                  : kind === 'reps'
                    ? 'For bodyweight moves like push-ups or pull-ups: you log reps, no weight.'
                    : 'You log the weight and the reps for each set.'}
              </Text>
              {error && <Text style={{ color: colors.danger }}>{error}</Text>}
              <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                <Button disabled={creating} onPress={() => setFormOpen(false)}>Cancel</Button>
                <Button mode="contained" loading={creating} disabled={creating || newName.trim().length === 0} onPress={create}>
                  Create &amp; add
                </Button>
              </View>
            </View>
          ) : (
            <>
              {error && <Text style={{ color: colors.danger }}>{error}</Text>}
              <Button mode="contained-tonal" icon="plus" onPress={openForm} contentStyle={{ height: 46 }}>
                {typed && !exactMatch ? `Create “${typed}”` : 'Create custom exercise'}
              </Button>
            </>
          )}
        </View>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={colors.accent} />
        ) : (
          <FlatList
            extraData={scheme}
            data={filtered}
            keyExtractor={(e) => e.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Pressable
                  onPress={() => onPick(item)}
                  android_ripple={{ color: colors.cardAlt }}
                  style={{ flex: 1, paddingLeft: 20, paddingRight: 8, paddingVertical: 14 }}
                >
                  <Text style={{ fontSize: 17, fontWeight: '600' }}>{item.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 13 }}>
                    {item.is_custom ? 'Custom' : item.muscle_group}
                    {item.timed ? '  ·  Timed' : item.reps_only ? '  ·  Reps only' : ''}
                  </Text>
                </Pressable>
                {item.is_custom && (
                  <IconButton
                    icon="delete-outline"
                    iconColor={colors.danger}
                    onPress={() => confirmDelete(item)}
                    accessibilityLabel={`Delete ${item.name}`}
                    style={{ marginRight: 8 }}
                  />
                )}
              </View>
            )}
            ListFooterComponent={librarySection ?? undefined}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', padding: 24, gap: 8 }}>
                <Text style={{ color: colors.muted }}>No matching exercise.</Text>
                {!formOpen && <Button onPress={openForm}>{typed ? `Create “${typed}”` : 'Create custom exercise'}</Button>}
              </View>
            }
          />
        )}
      </SafeAreaView>
    </>
  );
}

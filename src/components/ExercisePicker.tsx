import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { ActivityIndicator, Button, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';
import { createCustomExercise, loadExercises } from '../lib/exercises';
import { colors, useScheme } from '../theme';
import type { Exercise } from '../types';

type Props = {
  visible: boolean;
  onClose: () => void;
  onPick: (exercise: Exercise) => void;
};

export function ExercisePicker({ visible, onClose, onPick }: Props) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* Mounted only while open, so search/error/loading state resets on every open. */}
      {visible ? <PickerBody onClose={onClose} onPick={onPick} /> : null}
    </Modal>
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
  const [repsOnly, setRepsOnly] = useState(false);
  const [creating, setCreating] = useState(false);

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? all.filter((e) => e.name.toLowerCase().includes(q)) : all;
  }, [all, query]);

  const typed = query.trim();
  const exactMatch = all.some((e) => e.name.toLowerCase() === typed.toLowerCase());

  const openForm = () => {
    setNewName(typed);
    setRepsOnly(false);
    setError(null);
    setFormOpen(true);
  };

  const create = async () => {
    setCreating(true);
    setError(null);
    try {
      onPick(await createCustomExercise(newName, userId, all, repsOnly));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create exercise');
    } finally {
      setCreating(false);
    }
  };

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
                value={repsOnly ? 'reps' : 'weight'}
                onValueChange={(v) => setRepsOnly(v === 'reps')}
                buttons={[
                  { value: 'weight', label: 'Weight + reps', icon: 'weight-lifter' },
                  { value: 'reps', label: 'Reps only', icon: 'human-handsup' },
                ]}
              />
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {repsOnly
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
              <Pressable
                onPress={() => onPick(item)}
                android_ripple={{ color: colors.cardAlt }}
                style={{ paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}
              >
                <Text style={{ fontSize: 17, fontWeight: '600' }}>{item.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  {item.is_custom ? 'Custom' : item.muscle_group}
                  {item.reps_only ? '  ·  Reps only' : ''}
                </Text>
              </Pressable>
            )}
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

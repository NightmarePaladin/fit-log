import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { ActivityIndicator, Button, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';
import { createCustomExercise, loadExercises } from '../lib/exercises';
import { colors } from '../theme';
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
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [all, setAll] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    // Works with no connection: falls back to the built-in library plus custom exercises saved on this phone.
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

  const exactMatch = all.some((e) => e.name.toLowerCase() === query.trim().toLowerCase());

  const create = async () => {
    setCreating(true);
    setError(null);
    try {
      onPick(await createCustomExercise(query, userId, all));
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
              Offline: showing the built-in library. New custom exercises are saved on this phone.
            </Text>
          )}
          <TextInput
            mode="outlined"
            placeholder="Search or type a new exercise"
            value={query}
            onChangeText={setQuery}
            autoFocus
            left={<TextInput.Icon icon="magnify" />}
          />
          {error && <Text style={{ color: colors.danger }}>{error}</Text>}
          {query.trim().length > 0 && !exactMatch && (
            <Button mode="contained-tonal" icon="plus" loading={creating} disabled={creating} onPress={create}>
              Create custom “{query.trim()}”
            </Button>
          )}
        </View>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={colors.accent} />
        ) : (
          <FlatList
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
                </Text>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={{ color: colors.muted, textAlign: 'center', marginTop: 24 }}>No matches</Text>}
          />
        )}
      </SafeAreaView>
    </>
  );
}

import { useState } from 'react';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { useOnline } from '../hooks/useOnline';
import { visibleTo } from '../lib/localData';
import { uploadPending } from '../lib/saveFlow';
import { useLocalStore } from '../store/local';
import { colors } from '../theme';

/** One-line status under a screen's title: offline mode, no connection, or workouts waiting to upload. */
export function StatusBanner() {
  const { session, isGuest, exitOfflineMode } = useAuth();
  const userId = session?.user.id ?? null;
  const online = useOnline();
  const waiting = useLocalStore((s) => visibleTo(s.workouts, userId).length);
  const [syncing, setSyncing] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const syncNow = async () => {
    if (!userId) return;
    setSyncing(true);
    setNote(null);
    try {
      const r = await uploadPending(userId);
      if (r.offline) setNote('Still offline. Will retry when the connection returns.');
      else if (r.failed > 0) setNote(`${r.failed} workout${r.failed === 1 ? '' : 's'} could not be uploaded.`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setSyncing(false);
    }
  };

  let icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] | null = null;
  let tint: string = colors.gold;
  let text = '';
  let action: { label: string; onPress: () => void; loading?: boolean } | null = null;

  if (isGuest) {
    icon = 'cloud-off-outline';
    text = `Offline mode: not signed in. ${waiting} workout${waiting === 1 ? '' : 's'} saved on this device.`;
    action = { label: 'Sign in', onPress: exitOfflineMode };
  } else if (!online) {
    icon = 'wifi-off';
    text = waiting
      ? `You're offline. ${waiting} workout${waiting === 1 ? '' : 's'} will upload when you reconnect.`
      : "You're offline. Workouts you finish are saved on this device and uploaded later.";
  } else if (waiting > 0) {
    icon = 'cloud-upload-outline';
    tint = colors.blue;
    text = `${waiting} workout${waiting === 1 ? '' : 's'} waiting to upload.`;
    action = { label: 'Upload now', onPress: syncNow, loading: syncing };
  }

  if (!icon) return null;
  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14,
        backgroundColor: colors.card, borderWidth: 1, borderColor: tint,
      }}
      accessibilityRole="alert"
    >
      <MaterialCommunityIcons name={icon} size={22} color={tint} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 13 }}>{text}</Text>
        {note && <Text style={{ color: colors.muted, fontSize: 12 }}>{note}</Text>}
      </View>
      {action && (
        <Button compact loading={action.loading} disabled={action.loading} onPress={action.onPress}>
          {action.label}
        </Button>
      )}
    </View>
  );
}

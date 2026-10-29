import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { Button, Dialog, Portal, Snackbar, Text } from 'react-native-paper';
import { useAuth } from '../auth/AuthProvider';
import { useOnline } from '../hooks/useOnline';
import { showDialog } from '../lib/dialog';
import { uploadPending } from '../lib/saveFlow';
import { useLocalStore } from '../store/local';
import { colors, useScheme } from '../theme';

/**
 * Invisible while idle. When signed in and online it:
 *  - uploads the user's own queued workouts automatically, and
 *  - asks before uploading workouts made in offline mode (no account) to this account.
 */
export function SyncGate() {
  useScheme(); // re-render when the appearance changes
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const online = useOnline();
  const ownCount = useLocalStore((s) => (userId ? s.workouts.filter((w) => w.ownerId === userId).length : 0));
  const guestWorkouts = useLocalStore((s) => s.workouts.filter((w) => w.ownerId === null).length);
  const guestCount = guestWorkouts;

  const [tick, setTick] = useState(0);
  const [asked, setAsked] = useState(false); // "Not now" hides the prompt until the app is reopened
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Retry whenever the app comes back to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setTick((t) => t + 1);
    });
    return () => sub.remove();
  }, []);

  // Automatically upload this user's own queued workouts.
  useEffect(() => {
    if (!userId || !online || ownCount === 0) return;
    let cancelled = false;
    uploadPending(userId)
      .then((r) => {
        if (!cancelled && r.uploaded > 0) setMessage(`Uploaded ${r.uploaded} workout${r.uploaded === 1 ? '' : 's'}.`);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId, online, ownCount, tick]);

  const promptVisible = !!userId && online && guestCount > 0 && !asked;

  const upload = async () => {
    if (!userId) return;
    setBusy(true);
    try {
      useLocalStore.getState().claimGuest(userId); // only now do offline-mode workouts become this account's
      const r = await uploadPending(userId);
      setMessage(
        r.offline
          ? 'Connection lost. Your workouts are safe on this device and will upload automatically.'
          : `Uploaded ${r.uploaded} workout${r.uploaded === 1 ? '' : 's'} to your account.`,
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Upload failed. Your workouts are still on this device.');
    } finally {
      setBusy(false);
      setAsked(true);
    }
  };

  const discard = () =>
    showDialog('Delete these workouts?', `This permanently deletes the ${guestCount} workout${guestCount === 1 ? '' : 's'} saved on this device from offline mode.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => useLocalStore.getState().discardGuest() },
    ]);

  return (
    <Portal>
      <Dialog visible={promptVisible} onDismiss={() => !busy && setAsked(true)}>
        <Dialog.Title>Upload your offline workouts?</Dialog.Title>
        <Dialog.Content style={{ gap: 8 }}>
          <Text>
            You have {guestCount} workout{guestCount === 1 ? '' : 's'} saved on this device from offline mode. Upload{' '}
            {guestCount === 1 ? 'it' : 'them'} to {session?.user.email ?? 'your account'}?
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Choose Not now to keep them on this device and decide later.
          </Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button textColor={colors.danger} disabled={busy} onPress={discard}>Delete</Button>
          <Button disabled={busy} onPress={() => setAsked(true)}>Not now</Button>
          <Button mode="contained" loading={busy} disabled={busy} onPress={upload}>Upload</Button>
        </Dialog.Actions>
      </Dialog>
      <Snackbar visible={!!message} onDismiss={() => setMessage(null)} duration={5000}>
        {message}
      </Snackbar>
    </Portal>
  );
}

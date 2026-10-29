import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Button, IconButton, List, SegmentedButtons, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/auth/AuthProvider';
import { Card, SectionTitle } from '../src/components/ui';
import { showDialog } from '../src/lib/dialog';
import { visibleTo } from '../src/lib/localData';
import { useDraftStore } from '../src/store/draft';
import { GUEST, useLocalStore } from '../src/store/local';
import { colors, useScheme } from '../src/theme';

export default function Settings() {
  useScheme(); // re-render when the appearance changes
  const router = useRouter();
  const { session, isGuest, exitOfflineMode, signOut, unit, setUnit } = useAuth();
  const waiting = useLocalStore((s) => visibleTo(s.workouts, session?.user.id ?? null).length);
  const themeMode = useLocalStore((s) => s.themeMode);
  const [unitBusy, setUnitBusy] = useState(false);
  const [unitError, setUnitError] = useState<string | null>(null);

  const changeUnit = async (next: string) => {
    if (next !== 'lb' && next !== 'kg') return;
    setUnitBusy(true);
    setUnitError(null);
    try {
      await setUnit(next);
    } catch (e) {
      setUnitError(e instanceof Error ? e.message : 'Could not change unit. Nothing was changed.');
    } finally {
      setUnitBusy(false);
    }
  };
  const draft = useDraftStore((s) => s.draft);
  const ownsDraft = useDraftStore((s) => s.ownerId === (session?.user.id ?? GUEST));
  const [signingOut, setSigningOut] = useState(false);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const clearDraft = () =>
    showDialog('Discard unfinished workout?', 'This deletes the unsaved draft on this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => useDraftStore.getState().discard() },
    ]);

  const doSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  const confirmSignOut = () =>
    waiting > 0
      ? showDialog(
          'Sign out with workouts waiting?',
          `${waiting} workout${waiting === 1 ? ' is' : 's are'} saved on this device and not uploaded yet. They stay on this device and upload when you sign in again.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: doSignOut },
          ],
        )
      : doSignOut();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }}>
        <IconButton icon="arrow-left" onPress={back} accessibilityLabel="Back" />
        <Text variant="titleLarge" style={{ fontWeight: '800' }}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        <SectionTitle>Appearance</SectionTitle>
        <Card style={{ gap: 10 }}>
          <SegmentedButtons
            value={themeMode}
            onValueChange={(v) => {
              if (v === 'dark' || v === 'light' || v === 'system') useLocalStore.getState().setThemeMode(v);
            }}
            buttons={[
              { value: 'dark', label: 'Dark', icon: 'weather-night' },
              { value: 'light', label: 'Light', icon: 'white-balance-sunny' },
              { value: 'system', label: 'System', icon: 'cellphone' },
            ]}
          />
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {themeMode === 'system' ? 'Follows your device’s light or dark setting.' : 'Choose how Fit Lift looks.'}
          </Text>
        </Card>

        <SectionTitle>Preferences</SectionTitle>
        <Card style={{ paddingVertical: 4 }}>
          <List.Item
            title="Weight unit"
            description="Applies everywhere. Saved workouts are converted, not changed."
            left={(p) => <List.Icon {...p} icon="weight-pound" />}
          />
          <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}>
            <SegmentedButtons
              value={unit}
              onValueChange={changeUnit}
              buttons={[
                { value: 'lb', label: 'Pounds (lb)', disabled: unitBusy },
                { value: 'kg', label: 'Kilograms (kg)', disabled: unitBusy },
              ]}
            />
            {unitError && <Text style={{ color: colors.danger }}>{unitError}</Text>}
          </View>
          <List.Item
            title="Week starts on"
            description="Progress compares Monday–Sunday weeks in your local time"
            left={(p) => <List.Icon {...p} icon="calendar-week" />}
            right={() => <Text style={{ alignSelf: 'center', fontWeight: '800', color: colors.accent }}>Mon</Text>}
          />
        </Card>

        <SectionTitle>Account</SectionTitle>
        <Card style={{ paddingVertical: 4 }}>
          <List.Item
            title="Buddies"
            description="Share your lifts with a gym buddy"
            left={(p) => <List.Icon {...p} icon="account-group" />}
            right={(p) => <List.Icon {...p} icon="chevron-right" />}
            onPress={() => router.push('/buddies')}
          />
          {isGuest ? (
            <List.Item
              title="Sign in to upload"
              description="You are in offline mode. Sign in to save workouts to an account."
              left={(p) => <List.Icon {...p} icon="login" />}
              right={(p) => <List.Icon {...p} icon="chevron-right" />}
              onPress={exitOfflineMode}
            />
          ) : (
            <List.Item
              title="Account & profile"
              description="Name, email, delete account"
              left={(p) => <List.Icon {...p} icon="account-circle" />}
              right={(p) => <List.Icon {...p} icon="chevron-right" />}
              onPress={() => router.push('/account')}
            />
          )}
        </Card>

        <SectionTitle>Data on this device</SectionTitle>
        <Card style={{ gap: 8 }}>
          <Text style={{ color: colors.muted }}>
            {draft && ownsDraft
              ? `You have an unfinished workout with ${draft.exercises.length} exercise${draft.exercises.length === 1 ? '' : 's'} saved locally.`
              : 'No unfinished workout is stored on this device.'}
          </Text>
          <Text style={{ color: colors.muted }}>
            {waiting > 0
              ? `${waiting} finished workout${waiting === 1 ? '' : 's'} saved on this device and waiting to upload.`
              : 'All finished workouts are uploaded.'}
          </Text>
          <Button icon="delete-sweep" disabled={!draft || !ownsDraft} onPress={clearDraft}>
            Discard unfinished workout
          </Button>
        </Card>

        <SectionTitle>Session</SectionTitle>
        {isGuest ? (
          <Button mode="outlined" icon="login" onPress={exitOfflineMode}>
            Sign in
          </Button>
        ) : (
          <Button mode="outlined" icon="logout" loading={signingOut} disabled={signingOut} onPress={confirmSignOut}>
            Sign out
          </Button>
        )}

        <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 12, fontSize: 12 }}>
          FitLog v{Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

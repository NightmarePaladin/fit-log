import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Button, IconButton, List, SegmentedButtons, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/auth/AuthProvider';
import { Card, SectionTitle } from '../src/components/ui';
import { showDialog } from '../src/lib/dialog';
import { useDraftStore } from '../src/store/draft';
import { colors } from '../src/theme';

export default function Settings() {
  const router = useRouter();
  const { session, signOut, unit, setUnit } = useAuth();
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
  const ownsDraft = useDraftStore((s) => s.ownerId === session?.user.id);
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }}>
        <IconButton icon="arrow-left" onPress={back} accessibilityLabel="Back" />
        <Text variant="titleLarge" style={{ fontWeight: '800' }}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
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
            title="Account & profile"
            description="Name, email, delete account"
            left={(p) => <List.Icon {...p} icon="account-circle" />}
            right={(p) => <List.Icon {...p} icon="chevron-right" />}
            onPress={() => router.push('/account')}
          />
        </Card>

        <SectionTitle>Data on this device</SectionTitle>
        <Card style={{ gap: 8 }}>
          <Text style={{ color: colors.muted }}>
            {draft && ownsDraft
              ? `You have an unfinished workout with ${draft.exercises.length} exercise${draft.exercises.length === 1 ? '' : 's'} saved locally.`
              : 'No unfinished workout is stored on this device.'}
          </Text>
          <Button icon="delete-sweep" disabled={!draft || !ownsDraft} onPress={clearDraft}>
            Discard unfinished workout
          </Button>
        </Card>

        <SectionTitle>Session</SectionTitle>
        <Button mode="outlined" icon="logout" loading={signingOut} disabled={signingOut} onPress={doSignOut}>
          Sign out
        </Button>

        <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 12, fontSize: 12 }}>
          FitLog v{Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

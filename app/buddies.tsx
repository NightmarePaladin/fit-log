import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Button, Chip, IconButton, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  acceptInvite, buddyErrorMessage, cancelInvite, createInvite, listBuddies, listInvites, removeBuddy, stopSharingMine,
  type Buddy, type Invite,
} from '../src/api/buddies';
import { useAuth } from '../src/auth/AuthProvider';
import { Card, SectionTitle } from '../src/components/ui';
import { shareBaseUrl } from '../src/lib/config';
import { showDialog } from '../src/lib/dialog';
import { copyText, shareText } from '../src/lib/shareOut';
import { colors, useScheme } from '../src/theme';

export default function Buddies() {
  useScheme(); // re-render when the appearance changes
  const router = useRouter();
  const { session, exitOfflineMode } = useAuth();
  const me = session?.user.id ?? null;
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [busy, setBusy] = useState<null | 'invite' | 'accept' | 'load'>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const load = useCallback(async () => {
    if (!me) return;
    try {
      const [b, i] = await Promise.all([listBuddies(me), listInvites()]);
      setBuddies(b);
      setInvites(i);
    } catch (e) {
      setNote({ ok: false, text: buddyErrorMessage(e) });
    }
  }, [me]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!me) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: 'center', gap: 12 }}>
        <Text variant="titleLarge" style={{ fontWeight: '800' }}>Buddies need an account</Text>
        <Text style={{ color: colors.muted }}>
          Sign in so you and a buddy can see each other&apos;s lifts. Offline mode keeps workouts on this device only.
        </Text>
        <Button mode="contained" onPress={exitOfflineMode}>Sign in</Button>
        <Button onPress={back}>Back</Button>
      </SafeAreaView>
    );
  }

  const makeInvite = async () => {
    setBusy('invite');
    setNote(null);
    try {
      setNewCode(await createInvite());
      await load();
    } catch (e) {
      setNote({ ok: false, text: buddyErrorMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  const inviteMessage = (code: string) =>
    `Join me on Fit Lift so we can see each other's lifts. Open Buddies, enter this code: ${code} (valid for 7 days). ${shareBaseUrl()}`;

  const connect = () => {
    const code = codeInput.trim().toUpperCase();
    if (code.length < 6) {
      setNote({ ok: false, text: 'Enter the 8-character code your buddy sent you.' });
      return;
    }
    showDialog(
      'Connect with this buddy?',
      'You will both be able to see each other’s workouts. You can stop sharing any time.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Connect',
          onPress: async () => {
            setBusy('accept');
            setNote(null);
            try {
              await acceptInvite(code);
              setCodeInput('');
              setNote({ ok: true, text: 'Connected! You can now see each other’s workouts.' });
              await load();
            } catch (e) {
              setNote({ ok: false, text: buddyErrorMessage(e) });
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  const act = async (fn: () => Promise<void>, ok: string) => {
    setNote(null);
    try {
      await fn();
      setNote({ ok: true, text: ok });
      await load();
    } catch (e) {
      setNote({ ok: false, text: buddyErrorMessage(e) });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }}>
        <IconButton icon="arrow-left" onPress={back} accessibilityLabel="Back" />
        <Text variant="titleLarge" style={{ fontWeight: '800' }}>Buddies</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: colors.muted }}>
          Share your lifts with a gym buddy. Connect with an invite code and you can each see the other&apos;s workouts (read-only).
        </Text>
        {note && <Text style={{ color: note.ok ? colors.success : colors.danger }}>{note.text}</Text>}

        <SectionTitle>Invite a buddy</SectionTitle>
        <Card style={{ gap: 10 }}>
          <Button mode="contained" icon="account-plus" loading={busy === 'invite'} disabled={busy !== null} onPress={makeInvite}>
            Create invite code
          </Button>
          {newCode && (
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Text selectable style={{ fontSize: 34, fontWeight: '900', letterSpacing: 4, color: colors.accent }}>{newCode}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button compact icon="content-copy" onPress={() => copyText(newCode).then(() => setNote({ ok: true, text: 'Code copied.' }))}>
                  Copy
                </Button>
                <Button compact icon="share-variant" onPress={() => shareText(inviteMessage(newCode)).catch(() => {})}>
                  Send
                </Button>
              </View>
              <Text style={{ color: colors.muted, fontSize: 12 }}>One use only. Expires in 7 days.</Text>
            </View>
          )}
          {invites.filter((i) => i.code !== newCode).map((i) => (
            <View key={i.code} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: '700', letterSpacing: 2 }}>{i.code}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                expires {new Date(i.expires_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </Text>
              <Button compact textColor={colors.danger} onPress={() => act(() => cancelInvite(i.code), 'Invite cancelled.')}>Cancel</Button>
            </View>
          ))}
        </Card>

        <SectionTitle>Have a code?</SectionTitle>
        <Card style={{ gap: 10 }}>
          <TextInput
            mode="outlined"
            label="Buddy's code"
            value={codeInput}
            onChangeText={(t) => setCodeInput(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
            onSubmitEditing={connect}
          />
          <Button mode="contained-tonal" icon="link-variant" loading={busy === 'accept'} disabled={busy !== null || codeInput.length < 6} onPress={connect}>
            Connect
          </Button>
        </Card>

        <SectionTitle>Your buddies</SectionTitle>
        {buddies.length === 0 ? (
          <Card><Text style={{ color: colors.muted, textAlign: 'center' }}>No buddies yet. Create an invite code or enter one above.</Text></Card>
        ) : (
          buddies.map((b) => (
            <Card key={b.id} style={{ gap: 8 }}>
              <Text style={{ fontSize: 18, fontWeight: '800' }}>{b.name}</Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                <Chip compact icon={b.theyShareWithMe ? 'eye' : 'eye-off'}>{b.theyShareWithMe ? 'You can see theirs' : 'They stopped sharing'}</Chip>
                <Chip compact icon={b.iShareWithThem ? 'share' : 'share-off'}>{b.iShareWithThem ? 'They can see yours' : 'You stopped sharing'}</Chip>
              </View>
              <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
                <Button
                  compact mode="contained-tonal" icon="dumbbell" disabled={!b.theyShareWithMe}
                  onPress={() => router.push({ pathname: '/buddy/[id]', params: { id: b.id, name: b.name } })}
                >
                  View lifts
                </Button>
                {b.iShareWithThem && (
                  <Button
                    compact icon="share-off"
                    onPress={() =>
                      showDialog(`Stop sharing with ${b.name}?`, 'They will no longer see your workouts. You can still see theirs while they share.', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Stop sharing', style: 'destructive', onPress: () => act(() => stopSharingMine(me, b.id), 'You stopped sharing your workouts.') },
                      ])
                    }
                  >
                    Stop sharing mine
                  </Button>
                )}
                <Button
                  compact textColor={colors.danger} icon="account-remove"
                  onPress={() =>
                    showDialog(`Remove ${b.name}?`, 'This ends sharing in both directions.', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => act(() => removeBuddy(me, b.id), `${b.name} removed.`) },
                    ])
                  }
                >
                  Remove
                </Button>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Button, IconButton, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createSession, joinSession, listMySessions } from '../../src/api/walt';
import { useAuth } from '../../src/auth/AuthProvider';
import { Card, SectionTitle } from '../../src/components/ui';
import { pageWidth, useDesktop } from '../../src/lib/layout';
import { normalizeCode, waltErrorMessage, type WaltSession } from '../../src/lib/walt';
import { colors, useScheme } from '../../src/theme';

/** W.A.L.T. (We All Lift Together): start a live group workout, join one with a code, or get back into one. */
export default function WaltHome() {
  useScheme(); // re-render when the appearance changes
  const desktop = useDesktop();
  const router = useRouter();
  const { session, exitOfflineMode } = useAuth();
  const me = session?.user.id ?? null;
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<null | 'start' | 'join'>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<WaltSession[]>([]);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const load = useCallback(async () => {
    if (!me) return;
    try {
      setActive(await listMySessions());
    } catch (e) {
      setError(waltErrorMessage(e));
    }
  }, [me]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const open = (id: string) => router.push({ pathname: '/walt/[id]', params: { id } });

  const start = async () => {
    setBusy('start');
    setError(null);
    try {
      const { id } = await createSession(name);
      setName('');
      open(id);
    } catch (e) {
      setError(waltErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const join = async () => {
    if (code.length < 6) {
      setError('Enter the 8-character code from your lifting partner.');
      return;
    }
    setBusy('join');
    setError(null);
    try {
      const id = await joinSession(code);
      setCode('');
      open(id);
    } catch (e) {
      setError(waltErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  if (!me) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: 'center', gap: 12 }}>
        <Text variant="titleLarge" style={{ fontWeight: '800' }}>W.A.L.T. needs an account</Text>
        <Text style={{ color: colors.muted }}>
          Sign in so you and your lifting partners can see each other&apos;s sets live. Offline mode keeps workouts on this device only.
        </Text>
        <Button mode="contained" onPress={exitOfflineMode}>Sign in</Button>
        <Button onPress={back}>Back</Button>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }}>
        <IconButton icon="arrow-left" onPress={back} accessibilityLabel="Back" />
        <Text variant="titleLarge" style={{ fontWeight: '800' }}>W.A.L.T.</Text>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: desktop ? 28 : 16, gap: 14, paddingBottom: 40, ...pageWidth(desktop) }}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={{ gap: 6, alignItems: 'center' }}>
          <MaterialCommunityIcons name="arm-flex" size={40} color={colors.accent} />
          <Text style={{ fontSize: 22, fontWeight: '900' }}>We All Lift Together</Text>
          <Text style={{ color: colors.muted, textAlign: 'center' }}>
            Lift with up to 4 people. You share one exercise list and see each other&apos;s sets live. Everyone saves their own workout when they are done.
          </Text>
        </Card>

        {error && <Text style={{ color: colors.danger }}>{error}</Text>}

        <SectionTitle>Start a session</SectionTitle>
        <Card style={{ gap: 10 }}>
          <TextInput mode="outlined" label="Session name (optional)" value={name} onChangeText={setName} maxLength={60} placeholder="Leg day" />
          <Button mode="contained" icon="account-multiple-plus" loading={busy === 'start'} disabled={busy !== null} onPress={start}>
            Start W.A.L.T.
          </Button>
          <Text style={{ color: colors.muted, fontSize: 12 }}>You get a code to send to your lifting partners.</Text>
        </Card>

        <SectionTitle>Join with a code</SectionTitle>
        <Card style={{ gap: 10 }}>
          <TextInput
            mode="outlined"
            label="Session code"
            value={code}
            onChangeText={(t) => setCode(normalizeCode(t))}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
            onSubmitEditing={join}
          />
          <Button mode="contained-tonal" icon="login-variant" loading={busy === 'join'} disabled={busy !== null || code.length < 6} onPress={join}>
            Join
          </Button>
        </Card>

        {active.length > 0 && (
          <>
            <SectionTitle>Your active sessions</SectionTitle>
            {active.map((s) => (
              <Card key={s.id} style={{ gap: 6 }}>
                <Text style={{ fontSize: 18, fontWeight: '800' }}>{s.name}</Text>
                <Text style={{ color: colors.muted }}>
                  Code {s.code}  ·  {s.host_id === me ? 'You started this' : 'Joined'}
                </Text>
                <Button mode="contained-tonal" icon="play" onPress={() => open(s.id)}>Open</Button>
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

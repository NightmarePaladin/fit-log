import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Button, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { friendlyAuthError, useAuth } from '../src/auth/AuthProvider';
import { isValidEmail, signUpProblem } from '../src/lib/validation';
import { pageWidth, useDesktop } from '../src/lib/layout';
import { colors, useScheme } from '../src/theme';

type Mode = 'signin' | 'signup';

export default function Login() {
  useScheme(); // re-render when the appearance changes
  const desktop = useDesktop();
  const {
    signInWithGoogle, signInWithPassword, signUpWithPassword, resendConfirmation, sendPasswordReset, enterOfflineMode,
  } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState<null | 'password' | 'google' | 'reset' | 'resend'>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  /** email address awaiting confirmation (shows the "check your inbox" panel) */
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  const reset = () => {
    setError(null);
    setInfo(null);
    setNeedsConfirm(false);
  };

  const switchMode = (next: string) => {
    setMode(next as Mode);
    reset();
    setConfirm('');
  };

  const run = async (kind: NonNullable<typeof busy>, fn: () => Promise<void>) => {
    setBusy(kind);
    reset();
    try {
      await fn();
    } catch (e) {
      const msg = friendlyAuthError(e);
      setError(msg);
      if (msg.startsWith('Please confirm your email')) setNeedsConfirm(true);
    } finally {
      setBusy(null);
    }
  };

  const submit = () =>
    run('password', async () => {
      if (mode === 'signin') {
        if (!isValidEmail(email)) throw new Error('Enter a valid email address.');
        if (!password) throw new Error('Enter your password.');
        await signInWithPassword(email, password); // success: the route guard moves to the app
        return;
      }
      const problem = signUpProblem({ name, email, password, confirm });
      if (problem) throw new Error(problem);
      const result = await signUpWithPassword(name, email, password);
      if (result === 'confirm_email') setPendingEmail(email.trim());
    });

  const forgot = () =>
    run('reset', async () => {
      if (!isValidEmail(email)) throw new Error('Enter your email above first, then tap Forgot password.');
      await sendPasswordReset(email);
      setInfo('If an account exists for that email, a reset link is on its way.');
    });

  const resend = (address: string) =>
    run('resend', async () => {
      await resendConfirmation(address);
      setInfo('Confirmation email sent again.');
    });

  const google = () => run('google', signInWithGoogle);

  // Logo: name + icon, with the slogan underneath.
  const header = (
    <View style={{ alignItems: 'center', gap: 6, marginBottom: 24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text
          accessibilityRole="header"
          style={{ fontSize: 40, lineHeight: 46, fontWeight: '900', letterSpacing: -0.5, color: colors.text }}
        >
          Fit Log
        </Text>
        <View
          style={{
            width: 46, height: 46, borderRadius: 14, backgroundColor: colors.accent,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <MaterialCommunityIcons name="dumbbell" size={28} color="#fff" />
        </View>
      </View>
      <Text style={{ fontSize: 15, color: colors.muted, letterSpacing: 0.3 }}>Log Lifts Fast</Text>
    </View>
  );

  if (pendingEmail) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: 'center', ...pageWidth(desktop, 440) }}>
        {header}
        <View style={{ gap: 12, alignItems: 'center' }}>
          <MaterialCommunityIcons name="email-check-outline" size={48} color={colors.success} />
          <Text variant="titleLarge" style={{ fontWeight: '800' }}>Check your email</Text>
          <Text style={{ color: colors.muted, textAlign: 'center' }}>
            We sent a confirmation link to {pendingEmail}. Open it, then come back and sign in.
          </Text>
          {error && <Text style={{ color: colors.danger, textAlign: 'center' }}>{error}</Text>}
          {info && <Text style={{ color: colors.success, textAlign: 'center' }}>{info}</Text>}
          <Button mode="outlined" loading={busy === 'resend'} disabled={busy !== null} onPress={() => resend(pendingEmail)}>
            Resend email
          </Button>
          <Button
            onPress={() => {
              setPendingEmail(null);
              setMode('signin');
              reset();
            }}
          >
            Back to sign in
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'center', ...pageWidth(desktop, 440) }} keyboardShouldPersistTaps="handled">
          {header}

          <SegmentedButtons
            value={mode}
            onValueChange={switchMode}
            buttons={[
              { value: 'signin', label: 'Sign in' },
              { value: 'signup', label: 'Create account' },
            ]}
            style={{ marginBottom: 16 }}
          />

          <View style={{ gap: 12 }}>
            {mode === 'signup' && (
              <TextInput
                mode="outlined"
                label="Name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoComplete="name"
                maxLength={60}
              />
            )}
            <TextInput
              mode="outlined"
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
            />
            <TextInput
              mode="outlined"
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPw}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              right={<TextInput.Icon icon={showPw ? 'eye-off' : 'eye'} onPress={() => setShowPw((v) => !v)} />}
              onSubmitEditing={mode === 'signin' ? submit : undefined}
            />
            {mode === 'signup' && (
              <>
                <TextInput
                  mode="outlined"
                  label="Confirm password"
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry={!showPw}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  onSubmitEditing={submit}
                />
                <Text style={{ color: colors.muted, fontSize: 12 }}>At least 8 characters, with letters and numbers.</Text>
              </>
            )}

            {error && <Text style={{ color: colors.danger }}>{error}</Text>}
            {info && <Text style={{ color: colors.success }}>{info}</Text>}
            {needsConfirm && (
              <Button compact loading={busy === 'resend'} disabled={busy !== null} onPress={() => resend(email)}>
                Resend confirmation email
              </Button>
            )}

            <Button
              mode="contained"
              loading={busy === 'password'}
              disabled={busy !== null}
              onPress={submit}
              contentStyle={{ height: 52 }}
              labelStyle={{ fontSize: 16, fontWeight: '800' }}
              style={{ borderRadius: 14 }}
            >
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>

            {mode === 'signin' && (
              <Button compact loading={busy === 'reset'} disabled={busy !== null} onPress={forgot}>
                Forgot password?
              </Button>
            )}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 18 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <Text style={{ color: colors.muted }}>or</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>

          <Button
            mode="outlined"
            icon="google"
            loading={busy === 'google'}
            disabled={busy !== null}
            onPress={google}
            contentStyle={{ height: 52 }}
            labelStyle={{ fontSize: 16, fontWeight: '700' }}
            style={{ borderRadius: 14 }}
          >
            Continue with Google
          </Button>
          <Button
            icon="cloud-off-outline"
            onPress={enterOfflineMode}
            disabled={busy !== null}
            style={{ marginTop: 6 }}
            labelStyle={{ fontSize: 15 }}
          >
            Access while offline
          </Button>
          <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 12, marginTop: 4 }}>
            No signal at the gym? Log workouts on this device without an account. You can upload them when you sign in.
          </Text>
          <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 12, marginTop: 10 }}>
            Workouts in an account are private to that account.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

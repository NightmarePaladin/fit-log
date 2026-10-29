import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider, Text } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { SyncGate } from '../src/components/SyncGate';
import { isSupabaseConfigured } from '../src/lib/supabase';
import { ThemeSync } from '../src/components/ThemeSync';
import { SHELL_MAX_WIDTH, useDesktop } from '../src/lib/layout';
import { colors, makePaperTheme, useScheme } from '../src/theme';

function RootNav() {
  useScheme(); // re-render when the appearance changes
  const { session, loading, recovery, isGuest } = useAuth();
  const router = useRouter();

  // Opening a password-reset link signs the user in briefly; send them to set a new password.
  useEffect(() => {
    if (recovery && session) router.replace('/account');
  }, [recovery, session, router]);

  if (!isSupabaseConfigured) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: 'center' }}>
        <Text variant="headlineSmall">Supabase is not configured</Text>
        <Text style={{ color: colors.muted, marginTop: 8 }}>
          Copy .env.example to .env, fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY,
          then restart the dev server.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      {/* Signed in, or using offline mode (no account): both can use the app. */}
      <Stack.Protected guard={!!session || isGuest}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="active" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="workout/[id]" />
        <Stack.Screen name="account" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="buddies" />
        <Stack.Screen name="buddy/[id]" />
      </Stack.Protected>
      <Stack.Protected guard={!session && !isGuest}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Screen name="auth/callback" />
      {/* Public: anyone with a share link can open it without an account. */}
      <Stack.Screen name="s/[token]" />
    </Stack>
  );
}

/** On a wide desktop window the app sits in a centered column instead of stretching edge to edge. */
function Shell({ children }: { children: React.ReactNode }) {
  const desktop = useDesktop();
  if (!desktop) return <>{children}</>;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={{
          flex: 1, width: '100%', maxWidth: SHELL_MAX_WIDTH, alignSelf: 'center',
          borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border,
        }}
      >
        {children}
      </View>
    </View>
  );
}

export default function RootLayout() {
  const scheme = useScheme();
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <PaperProvider theme={makePaperTheme(scheme)}>
          <ThemeSync />
          <AuthProvider>
            <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
            <Shell>
              <RootNav />
            </Shell>
            <SyncGate />
          </AuthProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

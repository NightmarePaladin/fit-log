import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { colors, useScheme } from '../../src/theme';

/**
 * Landing route for fitlog://auth/callback. Email confirmation and password-reset links arrive here
 * with a one-time ?code=; exchange it for a session (unless Google sign-in already did), then continue.
 */
export default function AuthCallback() {
  useScheme(); // re-render when the appearance changes
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string }>();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (code) {
          const { data } = await supabase.auth.getSession();
          if (!data.session) await supabase.auth.exchangeCodeForSession(code);
        }
      } catch {
        // An expired or already-used link just lands on the login screen.
      }
      if (!cancelled) router.replace('/');
    })();
    return () => {
      cancelled = true;
    };
  }, [code, router]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  );
}

import { useState } from 'react';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../src/auth/AuthProvider';
import { colors } from '../src/theme';

export default function Login() {
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPress = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: 'space-between' }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
        <View
          style={{
            width: 96, height: 96, borderRadius: 28, backgroundColor: colors.accent,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <MaterialCommunityIcons name="dumbbell" size={52} color="#fff" />
        </View>
        <Text variant="displaySmall" style={{ fontWeight: '800' }}>FitLog</Text>
        <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 16 }}>
          Log lifts fast. See last time&apos;s numbers.{'\n'}Watch your strength climb week over week.
        </Text>
      </View>
      <View style={{ gap: 12 }}>
        {error && <Text style={{ color: colors.danger, textAlign: 'center' }}>{error}</Text>}
        <Button
          mode="contained"
          icon="google"
          loading={busy}
          disabled={busy}
          onPress={onPress}
          contentStyle={{ height: 56 }}
          labelStyle={{ fontSize: 17, fontWeight: '700' }}
          style={{ borderRadius: 16 }}
        >
          Continue with Google
        </Button>
        <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 12 }}>
          Your workouts are private to your account.
        </Text>
      </View>
    </SafeAreaView>
  );
}

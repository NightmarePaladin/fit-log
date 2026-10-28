import { View, type ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { colors, radius } from '../theme';

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View
      style={[
        { backgroundColor: colors.card, borderRadius: radius.card, padding: 16, borderWidth: 1, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Stat({ label, value, unit, tint }: { label: string; value: string; unit?: string; tint?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: colors.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <Text style={{ color: tint ?? colors.text, fontSize: 32, fontWeight: '800' }}>{value}</Text>
        {unit ? <Text style={{ color: colors.muted, fontSize: 14 }}>{unit}</Text> : null}
      </View>
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 8, marginBottom: 4 }}>{children}</Text>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card style={{ borderColor: colors.danger }}>
      <Text style={{ color: colors.danger }}>{message}</Text>
      {onRetry ? (
        <Text onPress={onRetry} style={{ color: colors.accent, marginTop: 8, fontWeight: '700' }}>
          Try again
        </Text>
      ) : null}
    </Card>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={{ alignItems: 'center', padding: 24, gap: 4 }}>
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{title}</Text>
      {hint ? <Text style={{ color: colors.muted, textAlign: 'center' }}>{hint}</Text> : null}
    </View>
  );
}

import { View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ShareCardData } from '../lib/shareCard';
import { palettes } from '../theme';

// The picture always uses the dark brand palette so shared images look the same in light and dark mode.
const c = palettes.dark;

/** The picture people post: branded, readable at a glance. Captured to a PNG by react-native-view-shot. */
export function ShareCard({ data, viewRef }: { data: ShareCardData; viewRef?: React.RefObject<unknown> }) {
  const rows = data.rows.slice(0, 9);
  const extra = data.rows.length - rows.length;
  return (
    <View
      ref={viewRef as never}
      collapsable={false}
      style={{ width: 340, backgroundColor: c.bg, padding: 20, gap: 14, borderRadius: 4 }}
    >
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 28, fontWeight: '900', color: c.text }}>Fit Lift</Text>
          <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="dumbbell" size={18} color="#fff" />
          </View>
        </View>
        <Text style={{ fontSize: 13, color: c.muted }}>Log Lifts Fast</Text>
      </View>

      <View style={{ backgroundColor: c.card, borderRadius: 18, padding: 16, gap: 12 }}>
        <View>
          <Text style={{ fontSize: 22, fontWeight: '800', color: c.text }} numberOfLines={2}>{data.title}</Text>
          <Text style={{ fontSize: 12, color: c.muted }}>{[data.owner, data.date].filter(Boolean).join('  ·  ')}</Text>
        </View>
        {rows.map((r, i) => (
          <View key={`${r.name}-${i}`}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }} numberOfLines={1}>{r.name}</Text>
            <Text style={{ fontSize: 13, color: c.muted }} numberOfLines={2}>{r.detail}</Text>
          </View>
        ))}
        {extra > 0 && <Text style={{ fontSize: 12, color: c.muted }}>+ {extra} more exercise{extra === 1 ? '' : 's'}</Text>}
        <Text style={{ fontSize: 20, fontWeight: '900', color: c.accent }}>{data.total}</Text>
      </View>
    </View>
  );
}

import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDesktop } from '../../src/lib/layout';
import { colors, useScheme } from '../../src/theme';

const icon = (name: React.ComponentProps<typeof MaterialCommunityIcons>['name']) => {
  const TabIcon = ({ color, size }: { color: unknown; size: number }) => (
    <MaterialCommunityIcons name={name} color={color as string} size={size + 2} />
  );
  TabIcon.displayName = `TabIcon(${name})`;
  return TabIcon;
};

export default function TabsLayout() {
  useScheme(); // re-render when the appearance changes
  const desktop = useDesktop();
  // Devices with gesture navigation draw the system bar over the app; keep the tabs above it.
  const { bottom } = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        // Desktop: a left sidebar with the brand on top. Phone: the usual bottom bar.
        tabBarPosition: desktop ? 'left' : 'bottom',
        tabBarVariant: desktop ? 'material' : 'uikit',
        tabBarStyle: desktop
          ? { backgroundColor: colors.card, borderRightColor: colors.border, borderRightWidth: 1, width: 210, paddingTop: 12 }
          : {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              height: 64 + bottom,
              paddingTop: 6,
              paddingBottom: bottom,
            },
        tabBarLabelStyle: desktop ? { fontSize: 15, fontWeight: '700' } : { fontSize: 12, fontWeight: '700', paddingBottom: 6 },
        tabBarItemStyle: desktop ? { borderRadius: 12, marginHorizontal: 10 } : undefined,
        tabBarActiveBackgroundColor: desktop ? colors.cardAlt : undefined,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: icon('view-dashboard') }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: icon('history') }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: icon('chart-line') }} />
    </Tabs>
  );
}

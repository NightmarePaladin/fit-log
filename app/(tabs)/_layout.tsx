import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
  // Devices with gesture navigation draw the system bar over the app; keep the tabs above it.
  const { bottom } = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 64 + bottom,
          paddingTop: 6,
          paddingBottom: bottom,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700', paddingBottom: 6 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: icon('view-dashboard') }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: icon('history') }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: icon('chart-line') }} />
    </Tabs>
  );
}

import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { useLocalStore } from '../store/local';
import { setScheme } from '../theme';

/** Applies the user's Appearance choice (Dark / Light / System) to the app's color scheme. */
export function ThemeSync() {
  const mode = useLocalStore((s) => s.themeMode);
  const system = useColorScheme();

  useEffect(() => {
    setScheme(mode === 'system' ? (system === 'light' ? 'light' : 'dark') : mode);
  }, [mode, system]);

  return null;
}

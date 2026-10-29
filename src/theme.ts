import { useSyncExternalStore } from 'react';
import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

export type Scheme = 'dark' | 'light';
export type ThemeMode = Scheme | 'system';

export type Palette = {
  bg: string;
  card: string;
  cardAlt: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  blue: string;
  success: string;
  danger: string;
  gold: string;
};

export const palettes: Record<Scheme, Palette> = {
  dark: {
    bg: '#14151A',
    card: '#1E2028',
    cardAlt: '#262935',
    border: '#2F3342',
    text: '#F2F3F7',
    muted: '#8B90A5',
    accent: '#7C6CFF',
    blue: '#4C8DFF',
    success: '#3DDC97',
    danger: '#FF6B6B',
    gold: '#FFC857',
  },
  light: {
    bg: '#F4F5FA',
    card: '#FFFFFF',
    cardAlt: '#ECEEF6',
    border: '#D8DBE8',
    text: '#14151A',
    muted: '#5F6580',
    accent: '#6C5CE7',
    blue: '#2F6FE0',
    success: '#168F5C',
    danger: '#D13B3B',
    gold: '#A86B00',
  },
};

// --- current scheme (tiny external store) -----------------------------------------------------
let current: Scheme = 'dark';
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const getScheme = (): Scheme => current;

export function setScheme(next: Scheme) {
  if (next === current) return;
  current = next;
  listeners.forEach((l) => l());
}

/**
 * Call at the top of a screen/layout component so it re-renders when the scheme changes.
 * Child components then pick up the new colors because they re-render with their parent.
 */
export function useScheme(): Scheme {
  return useSyncExternalStore(subscribe, getScheme, getScheme);
}

/** The live palette: each read returns the color for the CURRENT scheme. */
export const colors: Palette = new Proxy({} as Palette, {
  get: (_target, key: string) => palettes[current][key as keyof Palette],
});

export function makePaperTheme(scheme: Scheme) {
  const p = palettes[scheme];
  const base = scheme === 'dark' ? MD3DarkTheme : MD3LightTheme;
  return {
    ...base,
    roundness: 4,
    colors: {
      ...base.colors,
      primary: p.accent,
      onPrimary: '#FFFFFF',
      secondary: p.blue,
      background: p.bg,
      surface: p.card,
      surfaceVariant: p.cardAlt,
      onSurface: p.text,
      onSurfaceVariant: p.muted,
      outline: p.border,
      elevation: {
        ...base.colors.elevation,
        level0: 'transparent',
        level1: p.card,
        level2: p.card,
        level3: p.cardAlt,
      },
    },
  };
}

export const radius = { card: 20, pill: 999, input: 12 };

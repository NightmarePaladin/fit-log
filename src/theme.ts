import { MD3DarkTheme } from 'react-native-paper';

export const colors = {
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
};

export const paperTheme = {
  ...MD3DarkTheme,
  roundness: 4,
  colors: {
    ...MD3DarkTheme.colors,
    primary: colors.accent,
    onPrimary: '#FFFFFF',
    secondary: colors.blue,
    background: colors.bg,
    surface: colors.card,
    surfaceVariant: colors.cardAlt,
    onSurface: colors.text,
    onSurfaceVariant: colors.muted,
    outline: colors.border,
    elevation: {
      ...MD3DarkTheme.colors.elevation,
      level0: 'transparent',
      level1: colors.card,
      level2: colors.card,
      level3: colors.cardAlt,
    },
  },
};

export const radius = { card: 20, pill: 999, input: 12 };

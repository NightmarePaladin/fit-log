import { Platform, useWindowDimensions, type ViewStyle } from 'react-native';

/** The web build switches to a desktop layout (sidebar, centered content, dialogs) at this window width. */
export const DESKTOP_MIN_WIDTH = 900;
/** The whole app is centered in a column no wider than this on a big screen. */
export const SHELL_MAX_WIDTH = 1240;
/** Single-column pages (History, Settings, a workout...) read best at about this width. */
export const PAGE_MAX_WIDTH = 760;

/** True on the web in a wide window. Always false on Android/iOS, so the phone layout is never touched. */
export function useDesktop(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_MIN_WIDTH;
}

/** contentContainerStyle bits that center a single-column page on desktop (and do nothing on a phone). */
export const pageWidth = (desktop: boolean, max = PAGE_MAX_WIDTH): ViewStyle =>
  desktop ? { width: '100%', maxWidth: max, alignSelf: 'center' } : {};

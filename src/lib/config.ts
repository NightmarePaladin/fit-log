import { Platform } from 'react-native';

const DEFAULT_SHARE_BASE = 'https://fit-log-beryl-mu.vercel.app';

/**
 * The web address share links point at (https://.../s/<token>). On the web build this is the page's own address;
 * on the phone it comes from EXPO_PUBLIC_SHARE_URL, falling back to the production site.
 */
export function shareBaseUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return (process.env.EXPO_PUBLIC_SHARE_URL || DEFAULT_SHARE_BASE).replace(/\/+$/, '');
}

export const shareUrl = (token: string) => `${shareBaseUrl()}/s/${token}`;

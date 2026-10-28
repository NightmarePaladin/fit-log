import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { LargeSecureStore } from './secureStorage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
// Accept either name: `eas integrations:supabase:connect` writes ..._PUBLISHABLE_KEY, older setup used ..._ANON_KEY.
// Both are the public client key (safe in the app); Row Level Security protects the data.
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

const isWeb = Platform.OS === 'web';
const isServerRender = isWeb && typeof window === 'undefined';

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'missing-key', {
  auth: {
    // Native: AES-encrypted session with the key in Android Keystore.
    // Web: the browser's localStorage (SecureStore does not exist there).
    storage: isWeb ? (isServerRender ? undefined : window.localStorage) : new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: !isServerRender,
    // On web the OAuth redirect comes back to the page URL with ?code=...
    detectSessionInUrl: isWeb && !isServerRender,
    flowType: 'pkce',
  },
});

// Only refresh tokens while the app is in the foreground (native).
if (!isWeb) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

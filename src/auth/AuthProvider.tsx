import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import type { Unit } from '../lib/units';
import { useDraftStore } from '../store/draft';

WebBrowser.maybeCompleteAuthSession();

type AuthState = {
  session: Session | null;
  loading: boolean;
  /** first name, for greetings */
  displayName: string;
  /** full name as stored in profiles.display_name */
  fullName: string;
  avatarUrl: string | null;
  unit: Unit;
  setUnit: (unit: Unit) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (displayName: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // Tagged with the user id so a stale name from a previous account is never shown.
  const [profile, setProfile] = useState<{ id: string; name: string | null; unit: Unit } | null>(null);
  const userId = session?.user.id;
  const mine = profile && profile.id === userId ? profile : null;
  const profileName = mine?.name ?? null;
  const unit: Unit = mine?.unit ?? 'lb';

  useEffect(() => {
    // Restores the persisted (encrypted) session on app start.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  // The profile row is the source of truth for the name (editable on the Account page).
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('display_name,unit')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled)
          setProfile({ id: userId, name: data?.display_name ?? null, unit: data?.unit === 'kg' ? 'kg' : 'lb' });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const signInWithGoogle = useCallback(async () => {
    if (Platform.OS === 'web') {
      // Full-page redirect to Google and back; supabase-js exchanges the ?code= on load.
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
      return;
    }
    const redirectTo = Linking.createURL('auth/callback'); // fitlog://auth/callback in a dev/prod build
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data?.url) throw error ?? new Error('Could not start Google sign-in');

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') return; // user cancelled

    const url = new URL(result.url);
    const failure = url.searchParams.get('error_description') ?? url.searchParams.get('error');
    if (failure) throw new Error(failure);
    const code = url.searchParams.get('code');
    if (!code) throw new Error('Sign-in did not return an authorization code');
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const updateProfile = useCallback(
    async (displayName: string) => {
      if (!userId) throw new Error('Not signed in');
      const name = displayName.trim();
      if (name.length < 1 || name.length > 60) throw new Error('Name must be 1–60 characters.');
      const { error } = await supabase.from('profiles').update({ display_name: name }).eq('id', userId);
      if (error) throw error;
      setProfile((p) => ({ id: userId, name, unit: p?.unit ?? 'lb' }));
    },
    [userId],
  );

  const setUnit = useCallback(
    async (next: Unit) => {
      if (!userId || next === unit) return;
      const prev = unit;
      // Optimistic: flip the UI and convert any unfinished workout's typed weights together.
      setProfile((p) => ({ id: userId, name: p?.name ?? null, unit: next }));
      useDraftStore.getState().convertWeights(prev, next);
      const { error } = await supabase.from('profiles').update({ unit: next }).eq('id', userId);
      if (error) {
        setProfile((p) => ({ id: userId, name: p?.name ?? null, unit: prev }));
        useDraftStore.getState().convertWeights(next, prev);
        throw error;
      }
    },
    [userId, unit],
  );

  const deleteAccount = useCallback(async () => {
    const { error } = await supabase.rpc('delete_my_account');
    if (error) throw error;
    useDraftStore.getState().discard();
    // The server-side session is gone with the user; clear the local copy.
    await supabase.auth.signOut({ scope: 'local' });
  }, []);

  const value = useMemo<AuthState>(() => {
    const meta = session?.user.user_metadata ?? {};
    const full: string =
      profileName ?? meta.full_name ?? meta.name ?? session?.user.email?.split('@')[0] ?? 'there';
    return {
      session,
      loading,
      fullName: full,
      displayName: full.split(' ')[0],
      avatarUrl: (meta.avatar_url as string | undefined) ?? null,
      unit,
      signInWithGoogle,
      signOut,
      updateProfile,
      setUnit,
      deleteAccount,
    };
  }, [session, loading, profileName, unit, signInWithGoogle, signOut, updateProfile, setUnit, deleteAccount]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

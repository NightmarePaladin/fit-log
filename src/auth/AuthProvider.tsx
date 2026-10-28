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
  signInWithPassword: (email: string, password: string) => Promise<void>;
  /** 'signed_in' when confirmation is off; 'confirm_email' when a confirmation link was emailed. */
  signUpWithPassword: (name: string, email: string, password: string) => Promise<'signed_in' | 'confirm_email'>;
  resendConfirmation: (email: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  /** true after the user opens a password-reset link, until they set a new password */
  recovery: boolean;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (displayName: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
};

/** Where Supabase email links (confirm / reset) and OAuth send the user back to. */
const authRedirect = () => (Platform.OS === 'web' ? window.location.origin : Linking.createURL('auth/callback'));

/** Turn Supabase auth errors into messages a person can act on. */
export function friendlyAuthError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Email or password is incorrect.';
  if (m.includes('email not confirmed')) return 'Please confirm your email first. Check your inbox for the link.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Please wait a few minutes and try again.';
  if (m.includes('password should be at least') || m.includes('weak')) return 'That password is too weak. Use at least 8 characters.';
  if (m.includes('network') || m.includes('fetch')) return 'Could not reach the server. Check your connection and try again.';
  return msg;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(false);
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
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') setRecovery(false);
    });
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
        options: { redirectTo: authRedirect() },
      });
      if (error) throw error;
      return;
    }
    const redirectTo = authRedirect(); // fitlog://auth/callback in a dev/prod build
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
    if (exchangeError) {
      // The /auth/callback route may have exchanged the same one-time code first; that's fine.
      const { data: existing } = await supabase.auth.getSession();
      if (!existing.session) throw exchangeError;
    }
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
  }, []);

  const signUpWithPassword = useCallback(async (name: string, email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim() }, emailRedirectTo: authRedirect() },
    });
    if (error) throw error;
    // With email-enumeration protection, an already-registered address returns a user with no identities.
    if (data.user && data.user.identities?.length === 0) {
      throw new Error(
        'An account with this email already exists. Sign in instead, or use Continue with Google if you signed up with Google.',
      );
    }
    return data.session ? 'signed_in' : 'confirm_email';
  }, []);

  const resendConfirmation = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: authRedirect() },
    });
    if (error) throw error;
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirect() });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    setRecovery(false);
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
      signInWithPassword,
      signUpWithPassword,
      resendConfirmation,
      sendPasswordReset,
      recovery,
      updatePassword,
      signOut,
      updateProfile,
      setUnit,
      deleteAccount,
    };
  }, [
    session, loading, profileName, unit, recovery,
    signInWithGoogle, signInWithPassword, signUpWithPassword, resendConfirmation, sendPasswordReset,
    updatePassword, signOut, updateProfile, setUnit, deleteAccount,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

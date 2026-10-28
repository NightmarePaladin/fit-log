import { supabase } from './supabase';

/**
 * True when there is a usable session right now. When the stored token has expired this tries to refresh it,
 * so it also tells us whether the server is reachable. A false result means "treat as offline".
 */
export async function hasLiveSession(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    return !!data.session;
  } catch {
    return false;
  }
}

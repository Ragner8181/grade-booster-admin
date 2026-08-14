import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

type AdminAuthContextType = {
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthContextType>({
  session: null,
  isAdmin: false,
  loading: true,
  signOut: async () => {},
});

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  async function checkAdminStatus(currentSession: Session | null) {
    console.log('[AdminAuth] checkAdminStatus starting, session:', currentSession ? currentSession.user.email : 'none');

    if (!currentSession) {
      setIsAdmin(false);
      return;
    }

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

      console.log('[AdminAuth] querying profiles table via raw fetch...');
      const response = await fetch(
        `${supabaseUrl}/rest/v1/profiles?select=is_admin&id=eq.${currentSession.user.id}`,
        {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${currentSession.access_token}`,
          },
        }
      );

      if (!response.ok) {
        console.error('[AdminAuth] fetch returned non-OK status:', response.status);
        setIsAdmin(false);
        return;
      }

      const rows = await response.json();
      console.log('[AdminAuth] profiles fetch result:', rows);
      setIsAdmin(rows?.[0]?.is_admin ?? false);
    } catch (err: any) {
      console.error('[AdminAuth] checkAdminStatus failed:', err.message ?? err);
      setIsAdmin(false);
    }
  }

  useEffect(() => {
    console.log('[AdminAuth] provider mounted, checking initial session...');
    supabase.auth.getSession().then(async ({ data }) => {
      console.log('[AdminAuth] getSession resolved:', data.session ? data.session.user.email : 'no session');
      setSession(data.session);
      await checkAdminStatus(data.session);
      console.log('[AdminAuth] initial load complete, setting loading=false');
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log('[AdminAuth] auth state changed:', event, newSession ? newSession.user.email : 'no session');
      // Note: no setLoading(true) here on purpose. This fires on routine
      // background events too (e.g. TOKEN_REFRESHED, which can happen
      // frequently) — showing the full-page loading screen every time
      // caused the whole dashboard to flicker/reset while typing in forms.
      // We only want the blocking loading screen on the very first load.
      setSession(newSession);
      await checkAdminStatus(newSession);
      console.log('[AdminAuth] auth state change handling complete');
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AdminAuthContext.Provider value={{ session, isAdmin, loading, signOut }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}
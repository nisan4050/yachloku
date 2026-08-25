import { createContext, useContext, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/api/supabaseClient';

const AuthContext = createContext(undefined);

// Deep link the native app registers for Google to redirect back into after
// the system browser finishes the OAuth flow (see AndroidManifest.xml).
const NATIVE_OAUTH_REDIRECT = 'com.yachloku.app://auth-callback';

// Google refuses to complete sign-in inside an embedded WebView (the
// Capacitor app's normal webview) — it detects the user agent and blocks
// with "disallowed_useragent". The fix is to open the OAuth flow in the
// system browser (Chrome Custom Tabs) via @capacitor/browser and catch the
// redirect back into the app through a custom URL scheme instead.
async function signInWithGoogleNative() {
  const { Browser } = await import('@capacitor/browser');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: NATIVE_OAUTH_REDIRECT, skipBrowserRedirect: true },
  });
  if (error) return { error };

  await Browser.open({ url: data.url });
  return { error: null };
}

async function completeNativeOAuth(url) {
  const { Browser } = await import('@capacitor/browser');
  try {
    if (url.includes('code=')) {
      const code = new URL(url).searchParams.get('code');
      if (code) await supabase.auth.exchangeCodeForSession(code);
    } else if (url.includes('access_token=')) {
      const params = new URLSearchParams(url.split('#')[1] ?? '');
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (access_token && refresh_token) await supabase.auth.setSession({ access_token, refresh_token });
    }
  } finally {
    Browser.close().catch(() => {});
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle;
    import('@capacitor/app').then(({ App }) => {
      App.addListener('appUrlOpen', ({ url }) => {
        if (url.startsWith(NATIVE_OAUTH_REDIRECT)) completeNativeOAuth(url);
      }).then((h) => {
        handle = h;
      });
    });
    return () => handle?.remove();
  }, []);

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    signUp: (email, password, fullName) =>
      supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      }),
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signInWithGoogle: () =>
      Capacitor.isNativePlatform()
        ? signInWithGoogleNative()
        : supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin },
          }),
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

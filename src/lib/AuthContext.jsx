import { createContext, useContext, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/api/supabaseClient';
import { serverFetch, getToken, setToken, clearToken } from '@/api/server';

const AuthContext = createContext(undefined);

// Same OAuth client Supabase's Google provider is configured with (Project
// Settings -> Authentication -> Providers -> Google in the Supabase
// dashboard). Required as `webClientId` even on Android — that's what lets
// Credential Manager mint a Google ID token Supabase will accept.
const GOOGLE_WEB_CLIENT_ID = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;

let socialLoginInitialized = null;

// Fully native Google sign-in via Android's Credential Manager — the user
// picks one of the Google accounts already signed into the device, no
// browser and no WebView involved at any point (unlike a plain OAuth
// redirect, which Google actively blocks inside an embedded WebView with
// "disallowed_useragent", and which still requires *some* browser to exist
// on the device at all).
async function signInWithGoogleNative() {
  const { SocialLogin } = await import('@capgo/capacitor-social-login');

  if (!socialLoginInitialized) {
    socialLoginInitialized = SocialLogin.initialize({
      google: { webClientId: GOOGLE_WEB_CLIENT_ID },
    });
  }
  await socialLoginInitialized;

  const { result } = await SocialLogin.login({ provider: 'google', options: {} });
  if (!result.idToken) return { error: new Error('Google sign-in did not return an ID token') };

  const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: result.idToken });
  return { error: error ?? null };
}

const toAppUser = (u) => ({
  id: u.id,
  email: u.email,
  user_metadata: { full_name: u.name },
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) return;
    serverFetch('/auth/me')
      .then(({ user }) => setSession({ user: toAppUser(user) }))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const startSession = ({ token, user }) => {
    setToken(token);
    const next = { user: toAppUser(user) };
    setSession(next);
    return { session: next };
  };

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    signUp: async (email, password, fullName) => {
      try {
        const data = await serverFetch('/auth/register', {
          method: 'POST',
          body: { email, password, name: fullName },
        });
        return { data: startSession(data), error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    signIn: async (email, password) => {
      try {
        const data = await serverFetch('/auth/login', { method: 'POST', body: { email, password } });
        return { data: startSession(data), error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    signInWithGoogle: () =>
      Capacitor.isNativePlatform()
        ? signInWithGoogleNative()
        : supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${window.location.origin}/` },
          }),
    signOut: async () => {
      clearToken();
      setSession(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

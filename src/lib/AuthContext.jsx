import { createContext, useContext, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/api/supabaseClient';

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

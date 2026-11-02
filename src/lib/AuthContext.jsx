import { createContext, useContext, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { serverFetch, getToken, setToken, clearToken } from '@/api/server';

const AuthContext = createContext(undefined);

// Web OAuth client ID. The API verifies Google ID tokens against it, and on Android it must be
// passed as `webClientId` so Credential Manager mints a token the API will accept.
const GOOGLE_WEB_CLIENT_ID = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;

let socialLoginInitialized = null;

// Fully native Google sign-in via Android's Credential Manager — the user
// picks one of the Google accounts already signed into the device, no
// browser and no WebView involved at any point (unlike a plain OAuth
// redirect, which Google actively blocks inside an embedded WebView with
// "disallowed_useragent", and which still requires *some* browser to exist
// on the device at all).
async function getNativeGoogleIdToken() {
  const { SocialLogin } = await import('@capgo/capacitor-social-login');

  if (!socialLoginInitialized) {
    socialLoginInitialized = SocialLogin.initialize({
      google: { webClientId: GOOGLE_WEB_CLIENT_ID },
    });
  }
  await socialLoginInitialized;

  const { result } = await SocialLogin.login({ provider: 'google', options: {} });
  if (!result.idToken) throw new Error('Google sign-in did not return an ID token');
  return result.idToken;
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
    signInWithGoogleCredential: async (idToken) => {
      try {
        return { error: null, data: startSession(await serverFetch('/auth/google', { method: 'POST', body: { idToken } })) };
      } catch (error) {
        return { error };
      }
    },
    signInWithGoogle: async () => {
      try {
        const idToken = await getNativeGoogleIdToken();
        return { error: null, data: startSession(await serverFetch('/auth/google', { method: 'POST', body: { idToken } })) };
      } catch (error) {
        return { error };
      }
    },
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

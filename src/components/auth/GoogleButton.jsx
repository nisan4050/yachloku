import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { useLang } from '@/hooks/useLang';
import { Button } from '@/components/ui/button';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
let gisPromise = null;

function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve();
  gisPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => {
      gisPromise = null;
      reject(new Error('Failed to load Google sign-in'));
    };
    document.head.appendChild(script);
  });
  return gisPromise;
}

/** Google's official sign-in button on the web (returns an ID token the API verifies); the native flow keeps its own button. */
export function GoogleButton() {
  const { signInWithGoogle, signInWithGoogleCredential } = useAuth();
  const { lang } = useLang();
  const containerRef = useRef(null);
  const native = Capacitor.isNativePlatform();

  useEffect(() => {
    if (native) return;
    let cancelled = false;
    loadGoogleIdentity()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID,
          callback: async ({ credential }) => {
            const { error } = await signInWithGoogleCredential(credential);
            if (error) toast.error(error.message);
          },
        });
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          locale: lang,
          width: Math.min(containerRef.current.offsetWidth || 320, 400),
        });
      })
      .catch((err) => toast.error(err.message));
    return () => {
      cancelled = true;
    };
  }, [native, lang, signInWithGoogleCredential]);

  if (native) {
    return (
      <Button variant="outline" className="w-full" onClick={async () => {
        const { error } = await signInWithGoogle();
        if (error) toast.error(error.message);
      }}>
        Google
      </Button>
    );
  }
  return <div ref={containerRef} className="flex w-full justify-center" />;
}

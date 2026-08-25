import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const AccessibilityContext = createContext(undefined);
const STORAGE_KEY = 'yachloku:a11y';

const FONT_SCALES = ['sm', 'md', 'lg', 'xl'];
const FONT_SCALE_PX = { sm: '15px', md: '16px', lg: '18px', xl: '20px' };

function getInitial() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { highContrast: false, fontScale: 'md', ...stored };
  } catch {
    return { highContrast: false, fontScale: 'md' };
  }
}

export function AccessibilityProvider({ children }) {
  const [settings, setSettings] = useState(getInitial);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    document.documentElement.classList.toggle('high-contrast', settings.highContrast);
    document.documentElement.style.fontSize = FONT_SCALE_PX[settings.fontScale] ?? FONT_SCALE_PX.md;
  }, [settings]);

  const value = useMemo(
    () => ({
      ...settings,
      setHighContrast: (highContrast) => setSettings((s) => ({ ...s, highContrast })),
      setFontScale: (fontScale) => setSettings((s) => ({ ...s, fontScale })),
      fontScales: FONT_SCALES,
    }),
    [settings]
  );

  return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>;
}

export function useAccessibility() {
  const ctx = useContext(AccessibilityContext);
  if (ctx === undefined) throw new Error('useAccessibility must be used within an AccessibilityProvider');
  return ctx;
}

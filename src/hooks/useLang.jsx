import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LANG, LANGS, translate } from '@/lib/i18n';

const LangContext = createContext(undefined);
const STORAGE_KEY = 'yachloku:lang';

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = LANGS[lang].dir;
  }, [lang]);

  const value = useMemo(
    () => ({
      lang,
      dir: LANGS[lang].dir,
      setLang,
      toggleLang: () => setLang((l) => (l === 'he' ? 'en' : 'he')),
      t: (key) => translate(lang, key),
    }),
    [lang]
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (ctx === undefined) throw new Error('useLang must be used within a LangProvider');
  return ctx;
}

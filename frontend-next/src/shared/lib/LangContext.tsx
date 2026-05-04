'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  EARTHLY_BRANCHES,
  EVALUATION_TONES,
  FEATURE_NAMES,
  FIVE_ELEMENTS,
  HEAVENLY_STEMS,
  INPUT_LABELS,
  INTERACTIONS,
  PILLAR_LABELS,
  SINSAL,
  TEN_GODS,
  TEN_GODS_AXIS,
  TIME_PERIODS,
  TWELVE_STAGES,
  type GlossaryEntry,
} from '@/shared/constants/sajuGlossary';

export type Lang = 'ko' | 'en';

const STORAGE_KEY = 'lang';

interface LangContextValue {
  lang: Lang;
  setLang: (next: Lang) => void;
  t: (ko: string, en: string) => string;
  g: (term: string) => string;
}

const LangContext = createContext<LangContextValue | null>(null);

const GLOSSARY: Record<string, GlossaryEntry> = {
  ...FIVE_ELEMENTS,
  ...HEAVENLY_STEMS,
  ...EARTHLY_BRANCHES,
  ...TEN_GODS,
  ...TEN_GODS_AXIS,
  ...TIME_PERIODS,
  ...PILLAR_LABELS,
  ...INTERACTIONS,
  ...EVALUATION_TONES,
  ...TWELVE_STAGES,
  ...SINSAL,
  ...FEATURE_NAMES,
  ...INPUT_LABELS,
};

function getSavedLang(): Lang | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'ko' || v === 'en' ? v : null;
  } catch {
    return null;
  }
}

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ko');

  useEffect(() => {
    const initial = getSavedLang() ?? 'ko';
    setLangState(initial);
    document.documentElement.lang = initial;
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    document.documentElement.lang = next;
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
  }, []);

  const t = useCallback((ko: string, en: string) => (lang === 'en' ? en : ko), [lang]);

  const g = useCallback((term: string) => {
    if (lang !== 'en') return term;
    const entry = GLOSSARY[term];
    return entry?.en ?? term;
  }, [lang]);

  return (
    <LangContext.Provider value={{ lang, setLang, t, g }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) {
    return {
      lang: 'ko',
      setLang: () => {},
      t: (ko) => ko,
      g: (term) => term,
    };
  }
  return ctx;
}

'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { translations, Language, TranslationKey } from './translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'tesvault-language';

// Default translations
const defaultT = (key: TranslationKey): string => {
  const translation = translations[key];
  if (!translation) {
    return key;
  }
  return translation.zh || key;
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('zh');
  const [mounted, setMounted] = useState(false);

  // Load saved language on mount
  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
      if (saved && (saved === 'zh' || saved === 'en')) {
        setLanguageState(saved);
      } else if (saved === null) {
        // Try to detect browser language
        const browserLang = navigator.language.toLowerCase();
        if (browserLang.startsWith('en')) {
          setLanguageState('en');
        }
      }
    } catch (e) {
      // localStorage not available
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      // localStorage not available
    }
  };

  const t = (key: TranslationKey): string => {
    const translation = translations[key];
    if (!translation) {
      return key;
    }
    return translation[language] || translation.zh || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
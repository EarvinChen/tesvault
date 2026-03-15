'use client';

import { useLanguage } from '@/i18n/LanguageContext';
import { Language } from '@/i18n/translations';

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();

  const languages: { code: Language; label: string }[] = [
    { code: 'zh', label: '中文' },
    { code: 'en', label: 'EN' },
  ];

  return (
    <div className="flex items-center gap-2">
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => setLanguage(lang.code)}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            language === lang.code
              ? 'bg-blue-500 text-white'
              : 'bg-[#2a2a2a] text-[#a0a0a0] hover:bg-[#3a3a3a]'
          }`}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
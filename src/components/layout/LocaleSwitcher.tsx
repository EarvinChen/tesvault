'use client';

import { useI18n, type Locale } from '@/lib/i18n';

// Simple toggle button: 中 ↔ EN
export default function LocaleSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale } = useI18n();

  const toggle = () => {
    const next: Locale = locale === 'zh' ? 'en' : 'zh';
    setLocale(next);
  };

  return (
    <button
      onClick={toggle}
      className={`px-2 py-1 rounded-lg text-xs font-medium border transition-colors
        border-[#2a2a2a] text-[#aaa] hover:text-[#e5e5e5] hover:border-[#444] ${className}`}
      title={locale === 'zh' ? 'Switch to English' : '切換為中文'}
    >
      {locale === 'zh' ? 'EN' : '中文'}
    </button>
  );
}

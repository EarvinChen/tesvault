'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFileAccess, FileInputFallback, isIOS } from '@/hooks/useFileAccess';
import { useEventStore } from '@/stores/event-store';
import { useLanguage } from '@/i18n/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function LandingPage() {
  const router = useRouter();
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const ios = typeof navigator !== 'undefined' ? isIOS() : false;
  const { t } = useLanguage();

  const {
    openFolder,
    handleDragOver: hookDragOver,
    handleDragLeave: hookDragLeave,
    handleDrop: hookDrop,
    fileInputRef,
    handleInputChange,
  } = useFileAccess();

  // Subscribe to store — navigate as soon as loading is done and events exist.
  // This replaces the unreliable 500 ms setTimeout which fires before iOS USB
  // I/O completes, leaving the user stuck on the landing page.
  const isLoading = useEventStore((s) => s.isLoading);
  const events    = useEventStore((s) => s.events);

  useEffect(() => {
    if (!isLoading && events.length > 0) {
      router.push('/viewer');
    }
  }, [isLoading, events.length, router]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
    hookDragOver(e);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    hookDragLeave(e);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    setIsDraggingOver(false);
    await hookDrop(e);
  };

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0a] flex flex-col items-center justify-center px-4 safe-bottom">
      <FileInputFallback
        fileInputRef={fileInputRef}
        handleInputChange={handleInputChange}
      />

      <div className="max-w-2xl w-full">
        {/* Logo and title */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <svg className="w-12 h-12 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-13c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5z" />
          </svg>
          <h1 className="text-4xl font-bold text-[#e5e5e5]">TesVault</h1>
          <LanguageSwitcher />
        </div>

        {/* Title and subtitle */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-semibold text-[#e5e5e5] mb-2">{t('landing.title')}</h2>
          <p className="text-lg text-[#a0a0a0]">{t('landing.subtitle')}</p>
        </div>

        {/* iOS notice */}
        {ios && (
          <div className="mb-6 p-4 rounded-xl bg-blue-900/20 border border-blue-500/30 text-sm text-[#aaa] leading-relaxed">
            <p className="text-blue-400 font-semibold mb-1">{t('ios.title')}</p>
            <p>
              {t('ios.step1')}，
              {t('ios.step2')}，
              {t('ios.step3')}（或 SavedClips / SentryClips 裡的事件資料夾），
              {t('ios.step4')}。
            </p>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="mb-6 flex items-center justify-center gap-3 p-4 rounded-xl bg-[#141414] border border-[#2a2a2a]">
            <svg className="w-5 h-5 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            <span className="text-sm text-[#aaa]">讀取中，請稍候…</span>
          </div>
        )}

        {/* Drop zone */}
        <div
          className={`w-full p-12 rounded-xl border-2 border-dashed transition-all mb-8 cursor-pointer select-none ${
            isDraggingOver
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-[#2a2a2a] bg-[#141414] hover:border-blue-500/60 hover:bg-blue-500/5'
          }`}
          onClick={() => !isLoading && openFolder()}
          onDragOver={ios ? undefined : handleDragOver}
          onDragLeave={ios ? undefined : handleDragLeave}
          onDrop={ios ? undefined : handleDrop}
        >
          <div className="text-center pointer-events-none">
            <svg
              className={`w-12 h-12 mx-auto mb-4 transition-colors ${isDraggingOver ? 'text-blue-400' : 'text-[#a0a0a0]'}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            {ios ? (
              <>
                <p className="text-[#e5e5e5] font-medium mb-2">{t('landing.cta.ios')}</p>
                <p className="text-sm text-[#a0a0a0]">{t('ios.step3')}</p>
              </>
            ) : (
              <>
                <p className="text-[#e5e5e5] font-medium mb-2">{t('landing.cta.dragDrop')}</p>
                <p className="text-sm text-[#a0a0a0]">{t('landing.cta.clickToSelect')}</p>
              </>
            )}
          </div>
        </div>

        {/* Select button */}
        <div className="flex justify-center mb-12">
          <button
            onClick={() => !isLoading && openFolder()}
            disabled={isLoading}
            className="px-8 py-3 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-50 transition-colors text-white font-semibold"
          >
            {isLoading ? t('landing.loading') : ios ? t('landing.cta.ios') : t('landing.cta.button')}
          </button>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { icon: '📹', key: 'feature.6camera' },
            { icon: '⚡', key: 'feature.noInstall' },
            { icon: '🌙', key: 'feature.darkMode' },
            { icon: '⌨️', key: 'feature.keyboard' },
          ].map((feature, i) => (
            <div key={i} className="p-4 rounded-lg bg-[#141414] border border-[#2a2a2a] hover:border-[#3a3a3a] transition-colors">
              <div className="text-2xl mb-2">{feature.icon}</div>
              <h3 className="text-[#e5e5e5] font-semibold mb-1">{t(feature.key as any)}</h3>
              <p className="text-sm text-[#a0a0a0]">{t((feature.key + '.desc') as any)}</p>
            </div>
          ))}
        </div>

        {/* Keyboard shortcuts — desktop only */}
        {!ios && (
          <div className="mt-12 p-4 rounded-lg bg-[#141414] border border-[#2a2a2a]">
            <h3 className="text-[#e5e5e5] font-semibold mb-2">{t('shortcut.title')}</h3>
            <div className="grid grid-cols-2 gap-2 text-xs text-[#a0a0a0]">
              <div><span className="text-blue-500">Space</span> - {t('shortcut.playPause')}</div>
              <div><span className="text-blue-500">← / →</span> - {t('shortcut.backward')} / {t('shortcut.forward')}</div>
              <div><span className="text-blue-500">↑ / ↓</span> - {t('shortcut.volume')}</div>
              <div><span className="text-blue-500">F</span> - {t('shortcut.fullscreen')}</div>
              <div><span className="text-blue-500">, / .</span> - {t('shortcut.speed')}</div>
              <div><span className="text-blue-500">Esc</span> - {t('shortcut.exit')}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

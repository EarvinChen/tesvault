'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFileAccess, FileInputFallback } from '@/hooks/useFileAccess';
import { useEventStore } from '@/stores/event-store';
import { useViewerStore } from '@/stores/viewer-store';

export default function LandingPage() {
  const router = useRouter();
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const {
    openFolder,
    handleDragOver: hookDragOver,
    handleDragLeave: hookDragLeave,
    handleDrop: hookDrop,
  } = useFileAccess();

  const events = useEventStore((state) => state.events);

  // Enhanced drag handlers to show visual feedback
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

    // Navigate to viewer if events loaded
    setTimeout(() => {
      const currentEvents = useEventStore.getState().events;
      if (currentEvents.length > 0) {
        router.push('/viewer');
      }
    }, 500);
  };

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      await useEventStore.getState().loadFolder(files);

      // Navigate to viewer if events loaded
      setTimeout(() => {
        const currentEvents = useEventStore.getState().events;
        if (currentEvents.length > 0) {
          router.push('/viewer');
        }
      }, 500);
    }
    // Reset input for next selection
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSelectClick = async () => {
    await openFolder();

    // Navigate to viewer if events loaded
    setTimeout(() => {
      const currentEvents = useEventStore.getState().events;
      if (currentEvents.length > 0) {
        router.push('/viewer');
      }
    }, 500);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4">
      <FileInputFallback
        fileInputRef={fileInputRef}
        handleInputChange={handleInputChange}
      />

      <div className="max-w-2xl w-full">
        {/* Logo and title */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <svg
            className="w-12 h-12 text-blue-500"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-13c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5z" />
          </svg>
          <h1 className="text-4xl font-bold text-[#e5e5e5]">TesVault</h1>
        </div>

        {/* Title and subtitle */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-semibold text-[#e5e5e5] mb-2">
            Tesla 行車記錄器 Web 播放器
          </h2>
          <p className="text-lg text-[#a0a0a0]">
            免安裝・六鏡頭同步・瀏覽器直接開
          </p>
        </div>

        {/* Drop zone — also clickable to open folder picker */}
        <div
          className={`w-full p-12 rounded-xl border-2 border-dashed transition-all mb-8 cursor-pointer select-none ${
            isDraggingOver
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-[#2a2a2a] bg-[#141414] hover:border-blue-500/60 hover:bg-blue-500/5'
          }`}
          onClick={handleSelectClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="text-center pointer-events-none">
            <svg
              className={`w-12 h-12 mx-auto mb-4 transition-colors ${isDraggingOver ? 'text-blue-400' : 'text-[#a0a0a0]'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-[#e5e5e5] font-medium mb-2">
              拖放 TeslaCam 資料夾到此處
            </p>
            <p className="text-sm text-[#a0a0a0]">
              或點擊此處選擇資料夾
            </p>
          </div>
        </div>

        {/* Select folder button */}
        <div className="flex justify-center mb-12">
          <button
            onClick={handleSelectClick}
            className="px-8 py-3 rounded-lg bg-blue-500 hover:bg-blue-600 transition-colors text-white font-semibold"
          >
            選擇 TeslaCam 資料夾
          </button>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              icon: '📹',
              title: '六鏡頭同步',
              description: '支援最新 HW4 六鏡頭架構同步播放',
            },
            {
              icon: '⚡',
              title: '免安裝',
              description: '瀏覽器直接開，無需下載軟體',
            },
            {
              icon: '🌙',
              title: '深色主題',
              description: '專為夜間駕駛影片優化',
            },
            {
              icon: '⌨️',
              title: '鍵盤快捷鍵',
              description: '快速控制播放和調整設定',
            },
          ].map((feature, i) => (
            <div
              key={i}
              className="p-4 rounded-lg bg-[#141414] border border-[#2a2a2a] hover:border-[#3a3a3a] transition-colors"
            >
              <div className="text-2xl mb-2">{feature.icon}</div>
              <h3 className="text-[#e5e5e5] font-semibold mb-1">
                {feature.title}
              </h3>
              <p className="text-sm text-[#a0a0a0]">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="mt-12 p-4 rounded-lg bg-[#141414] border border-[#2a2a2a]">
          <h3 className="text-[#e5e5e5] font-semibold mb-2">快速鍵提示</h3>
          <div className="grid grid-cols-2 gap-2 text-xs text-[#a0a0a0]">
            <div><span className="text-blue-500">Space</span> - 播放/暫停</div>
            <div><span className="text-blue-500">← / →</span> - 快進/快退 5 秒</div>
            <div><span className="text-blue-500">↑ / ↓</span> - 音量</div>
            <div><span className="text-blue-500">F</span> - 全螢幕</div>
            <div><span className="text-blue-500">, / .</span> - 速度</div>
            <div><span className="text-blue-500">Esc</span> - 返回網格</div>
          </div>
        </div>
      </div>
    </div>
  );
}

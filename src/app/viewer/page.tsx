'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { VideoGrid } from '@/components/viewer/VideoGrid';
import { PlaybackControls } from '@/components/viewer/PlaybackControls';
import { Timeline } from '@/components/viewer/Timeline';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useViewerStore } from '@/stores/viewer-store';
import { useEventStore } from '@/stores/event-store';

export default function ViewerPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const currentEvent = useViewerStore((state) => state.currentEvent);
  const events = useEventStore((state) => state.events);

  useKeyboardShortcuts();

  // Auto-open sidebar when events are loaded but no event selected yet.
  // Handles mobile: user arrives at a blank screen after picking a folder.
  useEffect(() => {
    if (events.length > 0 && !currentEvent) {
      setSidebarOpen(true);
    }
  }, [events.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-close sidebar on mobile after an event is selected.
  // On desktop md:translate-x-0 keeps it visible regardless.
  useEffect(() => {
    if (currentEvent) {
      setSidebarOpen(false);
    }
  }, [currentEvent]);

  return (
    <div className="w-screen overflow-hidden bg-[#0a0a0a] flex flex-col pt-14" style={{ height: '100dvh' }}>

      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

      <div className="flex flex-1 min-h-0 overflow-hidden">

        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {currentEvent ? (
            <>
              <VideoGrid />
              <Timeline />
              <PlaybackControls />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center px-6">
                <svg
                  className="w-12 h-12 text-[#2a2a2a] mx-auto mb-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />
                </svg>
                <p className="text-[#e5e5e5] text-lg mb-2">請選擇一個事件</p>

                {/* Mobile: tap-to-open button (sidebar is hidden by default on mobile) */}
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="md:hidden mt-3 px-5 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 transition-colors text-white text-sm font-medium"
                >
                  開啟事件列表
                </button>

                {/* Desktop: sidebar always visible, just provide a hint */}
                <p className="hidden md:block text-[#a0a0a0] text-sm mt-1">
                  在左側邊欄選擇事件開始播放
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

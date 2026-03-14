'use client';

import React, { useState } from 'react';
import { useViewerStore } from '@/stores/viewer-store';

const PLAYBACK_RATES = [0.25, 0.5, 1, 1.5, 2, 4];

export function PlaybackControls() {
  const [showSpeedDropdown, setShowSpeedDropdown] = useState(false);

  const isPlaying       = useViewerStore((state) => state.isPlaying);
  const currentTime     = useViewerStore((state) => state.currentTime);
  const duration        = useViewerStore((state) => state.duration);
  const playbackRate    = useViewerStore((state) => state.playbackRate);
  const activeClipIndex = useViewerStore((state) => state.activeClipIndex);
  const clipOffset      = useViewerStore((state) => state.clipOffset);

  const play            = useViewerStore((state) => state.play);
  const pause           = useViewerStore((state) => state.pause);
  const seek            = useViewerStore((state) => state.seek);
  const setPlaybackRate = useViewerStore((state) => state.setPlaybackRate);
  const setActiveClip   = useViewerStore((state) => state.setActiveClip);

  const currentEvent    = useViewerStore((state) => state.currentEvent);
  const openExportModal = useViewerStore((state) => state.openExportModal);

  if (!currentEvent) {
    return null;
  }

  const totalClips = currentEvent.clips.length;

  const handlePlayPauseClick = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  const handleBackward = () => {
    seek(Math.max(0, currentTime - 10));
  };

  const handleForward = () => {
    seek(Math.min(duration, currentTime + 10));
  };

  /** Navigate to the previous 1-minute clip and pause. */
  const handlePrevClip = () => {
    if (activeClipIndex <= 0) return;
    pause();
    // Use the actual duration if available, otherwise approximate 60 s
    const prevOffset = Math.max(0, clipOffset - duration);
    setActiveClip(activeClipIndex - 1, prevOffset);
  };

  /** Navigate to the next 1-minute clip and pause. */
  const handleNextClip = () => {
    if (activeClipIndex >= totalClips - 1) return;
    pause();
    const newOffset = clipOffset + duration;
    setActiveClip(activeClipIndex + 1, newOffset);
  };

  const handleFullscreen = () => {
    const videoContainer = document.querySelector('[data-video-grid]');
    if (videoContainer && !document.fullscreenElement) {
      videoContainer.requestFullscreen().catch(() => {
        // Fullscreen request failed
      });
    } else if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  };

  return (
    <div className="w-full bg-[#0a0a0a] border-t border-[#2a2a2a] px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        {/* Left controls: seek buttons and play/pause */}
        <div className="flex items-center gap-3">
          {/* Backward 10s — counterclockwise circle arrow with "10" */}
          <button
            onClick={handleBackward}
            className="p-2 rounded-lg hover:bg-[#1a1a1a] transition-colors text-[#e5e5e5] hover:text-blue-500"
            title="後退 10 秒"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
              <text x="12" y="15.5" textAnchor="middle" fontSize="5.5" fontWeight="bold" fontFamily="system-ui, sans-serif">10</text>
            </svg>
          </button>

          {/* Play/Pause toggle */}
          <button
            onClick={handlePlayPauseClick}
            className="p-2 rounded-lg bg-blue-500 hover:bg-blue-600 transition-colors text-white"
            title={isPlaying ? '暫停 (空白鍵)' : '播放 (空白鍵)'}
          >
            {isPlaying ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Forward 10s */}
          <button
            onClick={handleForward}
            className="p-2 rounded-lg hover:bg-[#1a1a1a] transition-colors text-[#e5e5e5] hover:text-blue-500"
            title="前進 10 秒"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor" style={{ transform: 'scaleX(-1)' }}>
              <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
              <text transform="translate(24 0) scale(-1 1)" x="12" y="15.5" textAnchor="middle" fontSize="5.5" fontWeight="bold" fontFamily="system-ui, sans-serif">10</text>
            </svg>
          </button>
        </div>

        {/* Center: clip navigation (shown only when event has multiple clips) + speed */}
        <div className="flex items-center gap-3">
          {totalClips > 1 && (
            <div className="flex items-center gap-1.5">
              {/* Previous clip */}
              <button
                onClick={handlePrevClip}
                disabled={activeClipIndex <= 0}
                className="p-1.5 rounded-lg hover:bg-[#1a1a1a] transition-colors text-[#e5e5e5] hover:text-blue-500 disabled:opacity-30 disabled:cursor-not-allowed"
                title="上一片段"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
                </svg>
              </button>

              {/* Clip indicator */}
              <span className="text-xs text-[#a0a0a0] font-medium min-w-[32px] text-center">
                {activeClipIndex + 1}/{totalClips}
              </span>

              {/* Next clip */}
              <button
                onClick={handleNextClip}
                disabled={activeClipIndex >= totalClips - 1}
                className="p-1.5 rounded-lg hover:bg-[#1a1a1a] transition-colors text-[#e5e5e5] hover:text-blue-500 disabled:opacity-30 disabled:cursor-not-allowed"
                title="下一片段"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 18l8.5-6L6 6v12zm2.5-6 5.5 4V8z" />
                  <path d="M16 6h2v12h-2z" />
                </svg>
              </button>
            </div>
          )}

          {/* Speed dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSpeedDropdown(!showSpeedDropdown)}
              className="px-3 py-1 rounded-lg bg-[#1a1a1a] hover:bg-[#2a2a2a] transition-colors text-xs font-medium text-[#e5e5e5] border border-[#2a2a2a]"
              title="播放速度"
            >
              {playbackRate}x
            </button>

            {showSpeedDropdown && (
              <div className="absolute bottom-10 left-0 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg py-1 min-w-[80px] z-50">
                {PLAYBACK_RATES.map((rate) => (
                  <button
                    key={rate}
                    onClick={() => {
                      setPlaybackRate(rate);
                      setShowSpeedDropdown(false);
                    }}
                    className={`w-full px-3 py-1 text-xs text-left hover:bg-[#2a2a2a] transition-colors ${
                      playbackRate === rate
                        ? 'text-blue-500 font-semibold'
                        : 'text-[#e5e5e5]'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right controls: export + fullscreen */}
        <div className="flex items-center gap-2">
          {/* Export button */}
          <button
            onClick={openExportModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 active:bg-blue-700 transition-colors text-white text-xs font-semibold"
            title="匯出影片"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            匯出
          </button>

          {/* Fullscreen */}
          <button
            onClick={handleFullscreen}
            className="p-2 rounded-lg hover:bg-[#1a1a1a] transition-colors text-[#e5e5e5] hover:text-blue-500"
            title="全螢幕 (F)"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

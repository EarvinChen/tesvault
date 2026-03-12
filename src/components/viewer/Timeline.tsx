'use client';

import React, { useMemo } from 'react';
import { useViewerStore } from '@/stores/viewer-store';

export function Timeline() {
  const currentTime     = useViewerStore((state) => state.currentTime);
  const duration        = useViewerStore((state) => state.duration);
  const clipOffset      = useViewerStore((state) => state.clipOffset);
  const clipDurations   = useViewerStore((state) => state.clipDurations);
  const currentEvent    = useViewerStore((state) => state.currentEvent);
  const seekGlobal      = useViewerStore((state) => state.seekGlobal);

  // Global time = accumulated time of finished clips + current position
  const globalCurrentTime = clipOffset + currentTime;

  // Stable total duration: use actual clipDurations[] where known, 60 s estimate otherwise.
  // This avoids sudden slider-max jumps when a short final clip (e.g. 27 s instead of 60 s)
  // loads its metadata and the estimate would otherwise change significantly.
  const estimatedTotal = useMemo(() => {
    if (!currentEvent) return Math.max(duration, 1);
    let total = 0;
    for (let i = 0; i < currentEvent.clips.length; i++) {
      total += clipDurations[i] ?? 60;
    }
    return Math.max(total, 1);
  }, [currentEvent, clipDurations, duration]);

  // Format seconds as mm:ss
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const globalTimeFormatted = useMemo(() => formatTime(globalCurrentTime), [globalCurrentTime]);
  const totalFormatted      = useMemo(() => formatTime(estimatedTotal),    [estimatedTotal]);

  // Progress across the full estimated duration
  const progress = estimatedTotal > 0 ? (globalCurrentTime / estimatedTotal) * 100 : 0;

  // Seeking: pass the global time to seekGlobal which handles cross-clip navigation.
  // seekGlobal uses actual clipDurations[] when available, falling back to 60 s/clip.
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seekGlobal(parseFloat(e.target.value));
  };

  return (
    <div className="w-full px-4 py-2 bg-[#0a0a0a] border-b border-[#2a2a2a] space-y-2">
      {/* Progress slider spanning the full estimated event duration */}
      <input
        type="range"
        min="0"
        max={Math.max(estimatedTotal, 0)}
        value={globalCurrentTime}
        onChange={handleSeek}
        className="w-full h-1 bg-[#141414] rounded-lg appearance-none cursor-pointer accent-blue-500"
        style={{
          background: `linear-gradient(to right, rgb(59, 130, 246) 0%, rgb(59, 130, 246) ${progress}%, rgb(20, 20, 20) ${progress}%, rgb(20, 20, 20) 100%)`,
        }}
      />

      {/* Time display */}
      <div className="flex items-center justify-between text-xs text-[#e5e5e5]">
        <span>{globalTimeFormatted}</span>
        <span>/ {totalFormatted}</span>
      </div>
    </div>
  );
}

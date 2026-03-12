'use client';

import React, { useMemo } from 'react';
import { useViewerStore } from '@/stores/viewer-store';

export function Timeline() {
  const currentTime     = useViewerStore((state) => state.currentTime);
  const duration        = useViewerStore((state) => state.duration);
  const clipOffset      = useViewerStore((state) => state.clipOffset);
  const activeClipIndex = useViewerStore((state) => state.activeClipIndex);
  const currentEvent    = useViewerStore((state) => state.currentEvent);
  const seekGlobal      = useViewerStore((state) => state.seekGlobal);

  const totalClips = currentEvent?.clips.length ?? 1;

  // Global time = accumulated time of finished clips + current position
  const globalCurrentTime = clipOffset + currentTime;

  // Estimated total duration: use actual duration for the current clip,
  // plus 60 s for each remaining clip (approximate; clips are ~1 min each).
  const estimatedTotal = clipOffset + duration + (totalClips - activeClipIndex - 1) * 60;

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

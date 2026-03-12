'use client';

import React from 'react';
import type { TeslaCamEvent, EventType } from '@/types/tesla';
import { useEventStore } from '@/stores/event-store';

interface EventCardProps {
  event: TeslaCamEvent;
  isActive: boolean;
}

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  recent: '最近',
  saved: '保存',
  sentry: '哨兵',
};

const EVENT_TYPE_COLORS: Record<EventType, string> = {
  recent: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  saved: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  sentry: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export function EventCard({ event, isActive }: EventCardProps) {
  const selectEvent = useEventStore((state) => state.selectEvent);

  const handleClick = () => {
    selectEvent(event);
  };

  // Format timestamp
  const timestamp = event.timestamp.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // Format size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const cameraCount = event.cameras.size;
  const sizeFormatted = formatSize(event.totalSize);

  // Estimate total duration from clip count (~60 s per clip)
  const estimatedSeconds = event.clips.length * 60;
  const durationMin  = Math.floor(estimatedSeconds / 60);
  const durationSec  = String(estimatedSeconds % 60).padStart(2, '0');
  const durationLabel = `${durationMin}:${durationSec}`;

  return (
    <button
      onClick={handleClick}
      className={`w-full px-3 py-2 text-left rounded-lg border transition-all ${
        isActive
          ? 'bg-[#1a1a1a] border-blue-500/50 border-l-2 border-l-blue-500'
          : 'bg-[#141414] border-[#2a2a2a] hover:bg-[#1a1a1a] hover:border-[#3a3a3a]'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        {/* Left: type badge + info */}
        <div className="flex-1 min-w-0">
          {/* Type badge + duration */}
          <div className="flex items-center gap-1.5 mb-1">
            <div className={`inline-block px-2 py-0.5 rounded-full border text-xs font-semibold ${EVENT_TYPE_COLORS[event.type]}`}>
              {EVENT_TYPE_LABELS[event.type]}
            </div>
            <span className="text-xs text-[#666]">⏱ {durationLabel}</span>
          </div>

          {/* Timestamp */}
          <p className="text-xs text-[#e5e5e5] truncate font-mono">
            {timestamp}
          </p>

          {/* Camera count and size */}
          <div className="flex items-center gap-2 mt-1 text-xs text-[#a0a0a0]">
            <span>📹 {cameraCount} 鏡頭</span>
            <span>•</span>
            <span>{sizeFormatted}</span>
          </div>
        </div>

        {/* Right: indicator */}
        {event.isComplete ? (
          <div className="flex-shrink-0 text-green-500 text-lg" title="完整">
            ✓
          </div>
        ) : (
          <div className="flex-shrink-0 text-amber-500 text-lg" title="不完整">
            ⚠
          </div>
        )}
      </div>
    </button>
  );
}

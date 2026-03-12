'use client';

import React from 'react';
import { useEventStore } from '@/stores/event-store';
import { useViewerStore } from '@/stores/viewer-store';
import { EventCard } from './EventCard';
import type { EventType } from '@/types/tesla';

const FILTER_OPTIONS: Array<{ key: 'all' | EventType; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'recent', label: '最近' },
  { key: 'saved', label: '保存' },
  { key: 'sentry', label: '哨兵' },
];

export function EventList() {
  const events = useEventStore((state) => state.events);
  const activeFilter = useEventStore((state) => state.activeFilter);
  const isLoading = useEventStore((state) => state.isLoading);
  const setFilter = useEventStore((state) => state.setFilter);
  const getFilteredEvents = useEventStore((state) => state.getFilteredEvents);
  const currentEvent = useViewerStore((state) => state.currentEvent);

  const filteredEvents = getFilteredEvents();

  // Count events by type
  const countByType = (type: EventType) =>
    events.filter((e) => e.type === type).length;

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col gap-2 overflow-y-auto">
        {/* Loading skeleton */}
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="px-3 py-3 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a] animate-pulse"
          >
            <div className="h-4 bg-[#2a2a2a] rounded w-24 mb-2" />
            <div className="h-3 bg-[#2a2a2a] rounded w-32" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filter tabs */}
      <div className="px-3 py-2 border-b border-[#2a2a2a] flex gap-1 overflow-x-auto flex-shrink-0">
        {FILTER_OPTIONS.map(({ key, label }) => {
          const count =
            key === 'all'
              ? events.length
              : countByType(key as EventType);

          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                activeFilter === key
                  ? 'bg-blue-500 text-white'
                  : 'bg-[#1a1a1a] text-[#e5e5e5] hover:bg-[#2a2a2a] border border-[#2a2a2a]'
              }`}
            >
              {label}
              {count > 0 && <span className="ml-1 text-xs">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Events list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {filteredEvents.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <p className="text-[#a0a0a0] text-sm">沒有事件</p>
            </div>
          </div>
        ) : (
          filteredEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              isActive={currentEvent?.id === event.id}
            />
          ))
        )}
      </div>
    </div>
  );
}

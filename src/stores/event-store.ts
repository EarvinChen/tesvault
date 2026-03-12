import { create } from 'zustand';
import type { TeslaCamEvent, CameraConfigType, EventType } from '@/types/tesla';
import { parseTeslaCamFolder } from '@/lib/tesla/parser';
import { useViewerStore } from './viewer-store';

export interface EventStoreState {
  // Data
  events: TeslaCamEvent[];
  activeFilter: 'all' | EventType;
  sortOrder: 'newest' | 'oldest';
  isLoading: boolean;
  error: string | null;
  cameraConfig: CameraConfigType;

  // Actions
  loadFolder: (files: File[]) => Promise<void>;
  setFilter: (filter: 'all' | EventType) => void;
  setSort: (order: 'newest' | 'oldest') => void;
  selectEvent: (event: TeslaCamEvent) => void;
  /**
   * Switch which 1-minute clip is active within a multi-clip event (saved/sentry).
   * Updates both the event's cameras map and the viewer store.
   */
  setActiveClip: (eventId: string, clipIndex: number) => void;

  // Computed getter
  getFilteredEvents: () => TeslaCamEvent[];
}

export const useEventStore = create<EventStoreState>((set, get) => ({
  // Initial state
  events: [],
  activeFilter: 'all',
  sortOrder: 'newest',
  isLoading: false,
  error: null,
  cameraConfig: 'UNKNOWN',

  // Actions
  loadFolder: async (files: File[]) => {
    set({ isLoading: true, error: null });
    try {
      const result = parseTeslaCamFolder(files);

      // Asynchronously enrich saved/sentry events with event.json metadata and thumb URLs
      const enriched = await enrichEvents(result.events, files);

      set({
        events: enriched,
        cameraConfig: result.cameraConfig,
        error: result.error ? result.error.message : null,
      });

      // Sync camera count to viewer store
      if (result.cameraConfig === 'SIX_CAMERA') {
        useViewerStore.setState({ cameraCount: 6 });
      } else if (result.cameraConfig === 'FOUR_CAMERA') {
        useViewerStore.setState({ cameraCount: 4 });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '未知的錯誤' });
    } finally {
      set({ isLoading: false });
    }
  },

  setFilter: (filter: 'all' | EventType) => set({ activeFilter: filter }),

  setSort: (order: 'newest' | 'oldest') => set({ sortOrder: order }),

  selectEvent: (event: TeslaCamEvent) => {
    useViewerStore.getState().setCurrentEvent(event);
  },

  setActiveClip: (eventId: string, clipIndex: number) => {
    set((state) => {
      const events = state.events.map((ev) => {
        if (ev.id !== eventId) return ev;
        const idx = Math.max(0, Math.min(clipIndex, ev.clips.length - 1));
        const updated: TeslaCamEvent = {
          ...ev,
          activeClipIndex: idx,
          cameras: ev.clips[idx].cameras,
        };
        // If this is the currently playing event, update viewer store too
        const current = useViewerStore.getState().currentEvent;
        if (current?.id === eventId) {
          useViewerStore.getState().setCurrentEvent(updated);
        }
        return updated;
      });
      return { events };
    });
  },

  getFilteredEvents: () => {
    const state = get();
    let filtered = state.events;

    if (state.activeFilter !== 'all') {
      filtered = filtered.filter((e) => e.type === state.activeFilter);
    }

    const sorted = [...filtered];
    if (state.sortOrder === 'oldest') {
      sorted.reverse();
    }
    return sorted;
  },
}));

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Build a lookup from webkitRelativePath → File for fast access.
 */
function buildFileIndex(files: File[]): Map<string, File> {
  const index = new Map<string, File>();
  for (const f of files) {
    const key = f.webkitRelativePath || f.name;
    index.set(key, f);
  }
  return index;
}

/**
 * For saved/sentry events: read event.json and generate thumbnailUrl.
 * For all events: noop (returns event unchanged).
 */
async function enrichEvents(
  events: TeslaCamEvent[],
  allFiles: File[]
): Promise<TeslaCamEvent[]> {
  const fileIndex = buildFileIndex(allFiles);

  return Promise.all(
    events.map(async (ev) => {
      if (ev.type === 'recent') return ev;

      // Find the event.json file for this folder
      const enriched = { ...ev };

      // Look for event.json using folder name pattern
      for (const [path, file] of fileIndex) {
        if (path.includes(ev.folderName) && path.endsWith('event.json')) {
          try {
            const text = await file.text();
            const json = JSON.parse(text);

            // GPS location
            const lat = parseFloat(json.est_lat);
            const lon = parseFloat(json.est_lon);
            if (!isNaN(lat) && !isNaN(lon)) {
              enriched.location = {
                lat,
                lon,
                street: json.street || undefined,
                city:   json.city   || undefined,
              };
            }

            // Sentry trigger reason
            if (ev.type === 'sentry' && json.reason) {
              const r: string = json.reason;
              if (r.includes('motion'))    enriched.sentryTrigger = 'motion';
              else if (r.includes('impact')) enriched.sentryTrigger = 'impact';
              else if (r.includes('glass'))  enriched.sentryTrigger = 'glass_break';
              else if (r.includes('proximity')) enriched.sentryTrigger = 'proximity';
              else enriched.sentryTrigger = 'unknown';
            }
          } catch {
            // ignore malformed event.json
          }
          break;
        }
      }

      // Generate thumbnail URL from thumb.png
      for (const [path, file] of fileIndex) {
        if (path.includes(ev.folderName) && path.endsWith('thumb.png')) {
          enriched.thumbnailUrl = URL.createObjectURL(file);
          break;
        }
      }

      return enriched;
    })
  );
}

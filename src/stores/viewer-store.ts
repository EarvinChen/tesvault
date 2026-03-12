import { create } from 'zustand';
import type { CameraPosition, TeslaCamEvent } from '@/types/tesla';

export interface ViewerStoreState {
  // Playback state
  currentEvent: TeslaCamEvent | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  volume: number;
  isMuted: boolean;

  // Multi-clip state
  /** Index of the 1-minute clip currently loaded in the video elements */
  activeClipIndex: number;
  /** Accumulated wall-clock seconds from clips 0 … activeClipIndex-1, used for global time display */
  clipOffset: number;

  // Layout state
  focusedCamera: CameraPosition | null;
  layoutMode: 'grid' | 'focus';
  cameraCount: 4 | 6;

  // Export modal state
  showExportModal: boolean;

  // Actions
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setPlaybackRate: (rate: number) => void;
  focusCamera: (camera: CameraPosition) => void;
  unfocusCamera: () => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setCurrentEvent: (event: TeslaCamEvent | null) => void;
  setCameraCount: (count: 4 | 6) => void;
  openExportModal: () => void;
  closeExportModal: () => void;
  /**
   * Jump to a specific 1-minute clip.
   * @param index  Index into currentEvent.clips
   * @param offset Accumulated seconds before this clip (for global time display)
   */
  setActiveClip: (index: number, offset: number) => void;
}

export const useViewerStore = create<ViewerStoreState>((set) => ({
  // Initial state
  currentEvent: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  playbackRate: 1,
  volume: 0.8,
  isMuted: false,
  activeClipIndex: 0,
  clipOffset: 0,
  focusedCamera: null,
  layoutMode: 'grid',
  cameraCount: 6,
  showExportModal: false,

  // Actions
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  seek: (time: number) => set({ currentTime: time }),
  setVolume: (volume: number) => set({ volume: Math.max(0, Math.min(1, volume)) }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  setPlaybackRate: (rate: number) => set({ playbackRate: rate }),
  focusCamera: (camera: CameraPosition) =>
    set({ focusedCamera: camera, layoutMode: 'focus' }),
  unfocusCamera: () =>
    set({ focusedCamera: null, layoutMode: 'grid' }),
  setCurrentTime: (time: number) => set({ currentTime: time }),
  setDuration: (duration: number) => set({ duration }),
  setCurrentEvent: (event: TeslaCamEvent | null) => {
    // Reset all playback state when switching events; always start from clip 0
    return set({
      currentEvent: event,
      activeClipIndex: 0,
      clipOffset: 0,
      currentTime: 0,
      isPlaying: false,
      duration: event?.duration || 0,
    });
  },
  setCameraCount: (count: 4 | 6) => set({ cameraCount: count }),
  openExportModal:  () => set({ showExportModal: true }),
  closeExportModal: () => set({ showExportModal: false }),
  setActiveClip: (index: number, offset: number) =>
    set({ activeClipIndex: index, clipOffset: offset, currentTime: 0 }),
}));

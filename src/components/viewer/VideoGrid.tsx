'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useViewerStore } from '@/stores/viewer-store';
import { VideoPlayer } from './VideoPlayer';
import { ExportModal } from './ExportModal';
import type { CameraPosition } from '@/types/tesla';

// All 6 camera positions in fixed order
const ALL_CAMERAS: CameraPosition[] = [
  'front', 'back', 'left_front', 'right_front', 'left_rear', 'right_rear',
];

export function VideoGrid() {
  const currentEvent     = useViewerStore((s) => s.currentEvent);
  const cameraCount      = useViewerStore((s) => s.cameraCount);
  const focusedCamera    = useViewerStore((s) => s.focusedCamera);
  const layoutMode       = useViewerStore((s) => s.layoutMode);
  const isPlaying        = useViewerStore((s) => s.isPlaying);
  const playbackRate     = useViewerStore((s) => s.playbackRate);
  const volume           = useViewerStore((s) => s.volume);
  const isMuted          = useViewerStore((s) => s.isMuted);
  const currentTime      = useViewerStore((s) => s.currentTime);
  const activeClipIndex  = useViewerStore((s) => s.activeClipIndex);
  const clipOffset       = useViewerStore((s) => s.clipOffset);

  const setCurrentTime   = useViewerStore((s) => s.setCurrentTime);
  const setDuration      = useViewerStore((s) => s.setDuration);
  const pause            = useViewerStore((s) => s.pause);
  const unfocusCamera    = useViewerStore((s) => s.unfocusCamera);
  const showExportModal  = useViewerStore((s) => s.showExportModal);
  const closeExportModal = useViewerStore((s) => s.closeExportModal);
  const setActiveClip    = useViewerStore((s) => s.setActiveClip);

  // ── Individual refs for each camera ──────────────────────────────────────
  const refs = useRef<Record<CameraPosition, React.RefObject<HTMLVideoElement | null>>>({
    front:       React.createRef<HTMLVideoElement>(),
    back:        React.createRef<HTMLVideoElement>(),
    left_front:  React.createRef<HTMLVideoElement>(),
    right_front: React.createRef<HTMLVideoElement>(),
    left_rear:   React.createRef<HTMLVideoElement>(),
    right_rear:  React.createRef<HTMLVideoElement>(),
  });

  // ── Refs to latest values (read inside effects with different dep arrays) ─
  const isPlayingRef    = useRef(isPlaying);
  const playbackRateRef = useRef(playbackRate);
  useEffect(() => { isPlayingRef.current    = isPlaying;    }, [isPlaying]);
  useEffect(() => { playbackRateRef.current = playbackRate; }, [playbackRate]);

  // Set when handleEnded triggers an auto-advance to the next clip.
  // The blobUrls effect reads this to decide whether to auto-play after load.
  const advancingClipRef = useRef(false);

  // ── Blob URLs as React state so changes trigger re-renders ────────────────
  const [blobUrls, setBlobUrls] = useState<Partial<Record<CameraPosition, string>>>({});

  // ── Blob URL management — re-runs when event OR active clip changes ───────
  useEffect(() => {
    if (!currentEvent) {
      setBlobUrls({});
      return;
    }

    setBlobUrls((prev) => {
      Object.values(prev).forEach((url) => url && URL.revokeObjectURL(url));
      return {};
    });

    // Use the currently active 1-minute clip
    const clip = currentEvent.clips[activeClipIndex];
    if (!clip) { setBlobUrls({}); return; }

    const newUrls: Partial<Record<CameraPosition, string>> = {};
    clip.cameras.forEach((videoFile) => {
      if (videoFile.file && videoFile.file.size > 0) {
        newUrls[videoFile.camera] = URL.createObjectURL(videoFile.file);
      }
    });
    setBlobUrls(newUrls);

    return () => {
      Object.values(newUrls).forEach((url) => url && URL.revokeObjectURL(url));
    };
  }, [currentEvent, activeClipIndex]);

  // ── Auto-play after clip advance ─────────────────────────────────────────
  // When blobUrls updates because of a clip advance (advancingClipRef=true),
  // wait for the front video to be ready then restore playback.
  useEffect(() => {
    if (!advancingClipRef.current) return;
    advancingClipRef.current = false;

    lastSyncedTime.current = 0;

    const attemptPlay = () => {
      const frontEl = refs.current.front.current;
      if (!frontEl || frontEl.readyState < 1) {
        requestAnimationFrame(attemptPlay);
        return;
      }
      // Reset all cameras to t=0 and play
      ALL_CAMERAS.forEach((cam) => {
        const el = refs.current[cam].current;
        if (el) {
          el.currentTime = 0;
          el.playbackRate = playbackRateRef.current;
          el.play().catch(() => {});
        }
      });
    };

    requestAnimationFrame(attemptPlay);
  }, [blobUrls]);

  // ── Play / Pause ──────────────────────────────────────────────────────────
  useEffect(() => {
    ALL_CAMERAS.forEach((cam) => {
      const el = refs.current[cam].current;
      if (!el) return;
      if (isPlaying) {
        el.play().catch(() => {});
      } else {
        el.pause();
      }
    });
  }, [isPlaying]);

  // ── Playback rate ─────────────────────────────────────────────────────────
  useEffect(() => {
    ALL_CAMERAS.forEach((cam) => {
      const el = refs.current[cam].current;
      if (el) el.playbackRate = playbackRate;
    });
  }, [playbackRate]);

  // ── Volume & mute ─────────────────────────────────────────────────────────
  useEffect(() => {
    const el = refs.current.front.current;
    if (!el) return;
    el.volume = volume;
    el.muted  = isMuted;
  }, [volume, isMuted]);

  // ── Seek (only when change is >0.5s to avoid fighting timeupdate) ─────────
  const lastSyncedTime = useRef(0);
  useEffect(() => {
    if (Math.abs(currentTime - lastSyncedTime.current) < 0.5) return;
    // eslint-disable-next-line react-hooks/immutability
    lastSyncedTime.current = currentTime;
    ALL_CAMERAS.forEach((cam) => {
      const el = refs.current[cam].current;
      if (el && Math.abs(el.currentTime - currentTime) > 0.5) {
        el.currentTime = currentTime;
      }
    });
  }, [currentTime]);

  // ── Reset lastSyncedTime when clip changes ────────────────────────────────
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    lastSyncedTime.current = 0;
  }, [activeClipIndex]);

  // ── Re-sync ALL cameras after focus camera changes ────────────────────────
  useEffect(() => {
    let handle: number;

    const attemptSync = () => {
      const syncTime = lastSyncedTime.current;
      let allReady = true;

      ALL_CAMERAS.forEach((cam) => {
        const el = refs.current[cam].current;
        if (!el || el.readyState < 1) { allReady = false; return; }

        if (Math.abs(el.currentTime - syncTime) > 0.5) {
          el.currentTime = syncTime;
        }
        el.playbackRate = playbackRateRef.current;
      });

      if (allReady) {
        if (isPlayingRef.current) {
          ALL_CAMERAS.forEach((cam) => {
            refs.current[cam].current?.play().catch(() => {});
          });
        }
      } else {
        handle = requestAnimationFrame(attemptSync);
      }
    };

    handle = requestAnimationFrame(attemptSync);
    return () => cancelAnimationFrame(handle);
  }, [focusedCamera, layoutMode]);

  // ── Front-camera event handlers (master clock) ───────────────────────────

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const t = e.currentTarget.currentTime;
    // eslint-disable-next-line react-hooks/immutability
    lastSyncedTime.current = t;
    setCurrentTime(t);
  };

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    setDuration(e.currentTarget.duration);
    if (lastSyncedTime.current > 0) {
      e.currentTarget.currentTime = lastSyncedTime.current;
    }
  };

  /**
   * Called when the front camera's clip finishes.
   * Automatically advances to the next 1-minute clip; stops at the last.
   */
  const handleEnded = () => {
    if (!currentEvent) { pause(); return; }

    const totalClips = currentEvent.clips.length;
    const nextIndex  = activeClipIndex + 1;

    if (nextIndex < totalClips) {
      // Record actual duration of this clip for accurate global-time display
      const thisDuration = refs.current.front.current?.duration ?? 60;
      advancingClipRef.current = true; // signals auto-play effect
      setActiveClip(nextIndex, clipOffset + thisDuration);
      // isPlaying stays true; auto-play effect takes over once new blobUrls load
    } else {
      pause();
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────

  if (!currentEvent) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0a0a0a] min-h-0" data-video-grid>
        <p className="text-[#e5e5e5] text-lg">請選擇一個事件</p>
      </div>
    );
  }

  // Renders a single VideoPlayer; isFocused=true means clicking it exits focus mode
  const vp = (cam: CameraPosition, isFocused = false) => (
    <VideoPlayer
      camera={cam}
      videoRef={refs.current[cam]}
      blobUrl={blobUrls[cam]}
      isFocused={isFocused}
      onTimeUpdate={cam === 'front' ? handleTimeUpdate : undefined}
      onLoadedMetadata={cam === 'front' ? handleLoadedMetadata : undefined}
      onEnded={cam === 'front' ? handleEnded : undefined}
    />
  );

  // ── Focus mode ────────────────────────────────────────────────────────────
  if (layoutMode === 'focus' && focusedCamera) {
    const strip: CameraPosition[] = (cameraCount === 6 ? ALL_CAMERAS : ALL_CAMERAS.slice(0, 4))
      .filter((c) => c !== focusedCamera);

    return (
      <div className="flex-1 flex flex-col bg-[#0a0a0a] min-h-0" data-video-grid>
        {/* Main (focused) camera */}
        <div className="flex-1 min-h-0 relative">
          {vp(focusedCamera, true)}

          {/* Exit focus mode button — top-right corner */}
          <button
            onClick={unfocusCamera}
            className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 hover:bg-[#1a1a1a]/90 backdrop-blur-sm border border-[#2a2a2a] text-[#e5e5e5] text-xs font-medium transition-colors"
            title="返回總覽 (Esc)"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 3h8v8H3V3zm0 10h8v8H3v-8zm10-10h8v8h-8V3zm0 10h8v8h-8v-8z" />
            </svg>
            返回
          </button>

        </div>

        {/* Thumbnail strip — other cameras */}
        <div className="h-20 bg-[#141414] border-t border-[#2a2a2a] flex gap-1 p-1 overflow-x-auto flex-shrink-0">
          {strip.map((cam) => (
            <div key={cam} className="h-full w-32 flex-shrink-0">{vp(cam)}</div>
          ))}
        </div>

        {showExportModal && (
          <ExportModal blobUrls={blobUrls} onClose={closeExportModal} />
        )}
      </div>
    );
  }

  // ── 6-camera grid ─────────────────────────────────────────────────────────
  if (cameraCount === 6) {
    return (
      <div className="flex-1 flex flex-col bg-[#0a0a0a] overflow-hidden min-h-0 relative" data-video-grid>
        <div className="h-[35%] border-b border-[#2a2a2a] flex-shrink-0">{vp('front')}</div>
        <div className="flex-1 flex gap-1 p-1 min-h-0">
          <div className="flex-1 flex flex-col gap-1 min-w-0">
            <div className="flex-1 min-h-0 border border-[#2a2a2a] rounded-sm overflow-hidden">{vp('left_front')}</div>
            <div className="flex-1 min-h-0 border border-[#2a2a2a] rounded-sm overflow-hidden">{vp('left_rear')}</div>
          </div>
          <div className="flex-1 flex flex-col gap-1 min-w-0">
            <div className="flex-1 min-h-0 border border-[#2a2a2a] rounded-sm overflow-hidden">{vp('right_front')}</div>
            <div className="flex-1 min-h-0 border border-[#2a2a2a] rounded-sm overflow-hidden">{vp('right_rear')}</div>
          </div>
        </div>
        <div className="h-[20%] border-t border-[#2a2a2a] flex-shrink-0">{vp('back')}</div>

        {showExportModal && (
          <ExportModal blobUrls={blobUrls} onClose={closeExportModal} />
        )}
      </div>
    );
  }

  // ── 4-camera grid ─────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col bg-[#0a0a0a] overflow-hidden min-h-0 relative" data-video-grid>
      <div className="h-[35%] border-b border-[#2a2a2a] flex-shrink-0">{vp('front')}</div>
      <div className="flex-1 flex gap-1 p-1 min-h-0">
        <div className="flex-1 min-h-0 border border-[#2a2a2a] rounded-sm overflow-hidden">{vp('left_front')}</div>
        <div className="flex-1 min-h-0 border border-[#2a2a2a] rounded-sm overflow-hidden">{vp('right_front')}</div>
      </div>
      <div className="h-[20%] border-t border-[#2a2a2a] flex-shrink-0">{vp('back')}</div>

      {showExportModal && (
        <ExportModal blobUrls={blobUrls} onClose={closeExportModal} />
      )}
    </div>
  );
}

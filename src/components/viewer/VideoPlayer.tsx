'use client';

import React from 'react';
import { useI18n } from '@/lib/i18n';
import { getCameraLabel } from '@/lib/tesla/camera-config';
import type { CameraPosition } from '@/types/tesla';
import { useViewerStore } from '@/stores/viewer-store';

interface VideoPlayerProps {
  camera: CameraPosition;
  /** Pre-created blob URL for the video source */
  blobUrl?: string;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  /**
   * When true, this camera is currently the focused (enlarged) one.
   * Clicking it will exit focus mode instead of re-focusing it.
   */
  isFocused?: boolean;
  /** React synthetic event handlers (only passed to the primary / front camera) */
  onTimeUpdate?: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
  onLoadedMetadata?: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
  onEnded?: () => void;
}

export function VideoPlayer({
  camera,
  blobUrl,
  videoRef,
  isFocused = false,
  onTimeUpdate,
  onLoadedMetadata,
  onEnded,
}: VideoPlayerProps) {
  const { t } = useI18n();
  const focusCamera   = useViewerStore((state) => state.focusCamera);
  const unfocusCamera = useViewerStore((state) => state.unfocusCamera);

  const handleClick = () => {
    if (isFocused) {
      // Click the currently-focused camera → exit focus mode
      unfocusCamera();
    } else {
      // Click any other camera → focus it
      focusCamera(camera);
    }
  };

  const cameraLabel   = getCameraLabel(camera, 'zh-TW');
  const cameraLabelEn = getCameraLabel(camera, 'en');

  return (
    <div
      className="relative w-full h-full bg-[#0a0a0a] cursor-pointer overflow-hidden"
      onClick={handleClick}
    >
      {blobUrl ? (
        <video
          ref={videoRef}
          src={blobUrl}
          className="w-full h-full object-contain"
          playsInline
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoadedMetadata}
          onEnded={onEnded}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-[#141414]" />
      )}

      {/* Camera label badge */}
      <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm border border-[#2a2a2a]">
        <span className="text-blue-500">●</span>
        <span className="text-sm font-medium text-[#e5e5e5]">{cameraLabel}</span>
      </div>

      {/* Hover overlay */}
      {blobUrl && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/30 backdrop-blur-sm pointer-events-none">
          {isFocused ? (
            // Focused camera: hint that clicking shrinks back to grid
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black/60 border border-[#2a2a2a]">
              <svg className="w-4 h-4 text-[#e5e5e5]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
              </svg>
              <span className="text-sm text-[#e5e5e5]">{t('videoGrid.shrink')}</span>
            </div>
          ) : (
            // Normal camera: hint that clicking enlarges it
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black/60 border border-[#2a2a2a]">
              <svg className="w-4 h-4 text-[#e5e5e5]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
              </svg>
              <span className="text-sm text-[#e5e5e5]">{t('videoGrid.enlarge')} ({cameraLabelEn})</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

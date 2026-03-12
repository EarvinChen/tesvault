'use client';

import { useEffect } from 'react';
import { useViewerStore } from '@/stores/viewer-store';

export function useKeyboardShortcuts() {
  const viewerStore = useViewerStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we're typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      ) {
        return;
      }

      switch (e.code) {
        // Space: toggle play/pause
        case 'Space':
          e.preventDefault();
          if (viewerStore.currentEvent) {
            if (viewerStore.isPlaying) {
              viewerStore.pause();
            } else {
              viewerStore.play();
            }
          }
          break;

        // Arrow left: seek -5s
        case 'ArrowLeft':
          e.preventDefault();
          viewerStore.seek(Math.max(0, viewerStore.currentTime - 5));
          break;

        // Arrow right: seek +5s
        case 'ArrowRight':
          e.preventDefault();
          viewerStore.seek(Math.min(viewerStore.duration, viewerStore.currentTime + 5));
          break;

        // Arrow up: volume +0.1
        case 'ArrowUp':
          e.preventDefault();
          viewerStore.setVolume(viewerStore.volume + 0.1);
          break;

        // Arrow down: volume -0.1
        case 'ArrowDown':
          e.preventDefault();
          viewerStore.setVolume(viewerStore.volume - 0.1);
          break;

        // Shift + ,: decrease playback rate
        case 'Comma':
          e.preventDefault();
          const currentRate = viewerStore.playbackRate;
          const newRateDown =
            currentRate <= 0.25
              ? 0.25
              : currentRate === 0.5
                ? 0.25
                : currentRate === 1
                  ? 0.5
                  : currentRate === 1.5
                    ? 1
                    : currentRate === 2
                      ? 1.5
                      : currentRate === 4
                        ? 2
                        : 0.25;
          viewerStore.setPlaybackRate(newRateDown);
          break;

        // Shift + .: increase playback rate
        case 'Period':
          e.preventDefault();
          const currentRateUp = viewerStore.playbackRate;
          const newRateUp =
            currentRateUp < 0.25
              ? 0.25
              : currentRateUp === 0.25
                ? 0.5
                : currentRateUp === 0.5
                  ? 1
                  : currentRateUp === 1
                    ? 1.5
                    : currentRateUp === 1.5
                      ? 2
                      : currentRateUp === 2
                        ? 4
                        : 4;
          viewerStore.setPlaybackRate(newRateUp);
          break;

        // Frame step backward: shift + left arrow (±1/30s)
        case 'ArrowLeft':
          if (e.shiftKey) {
            e.preventDefault();
            viewerStore.seek(Math.max(0, viewerStore.currentTime - 1 / 30));
          }
          break;

        // Frame step forward: shift + right arrow (±1/30s)
        case 'ArrowRight':
          if (e.shiftKey) {
            e.preventDefault();
            viewerStore.seek(Math.min(viewerStore.duration, viewerStore.currentTime + 1 / 30));
          }
          break;

        // f: toggle fullscreen
        case 'KeyF':
          e.preventDefault();
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            document.documentElement.requestFullscreen();
          }
          break;

        // Escape: unfocus camera
        case 'Escape':
          e.preventDefault();
          if (viewerStore.focusedCamera) {
            viewerStore.unfocusCamera();
          }
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewerStore]);
}

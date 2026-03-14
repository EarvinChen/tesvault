'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useEventStore } from '@/stores/event-store';

// === iOS detection ===

/**
 * Returns true when running on iOS (iPhone / iPad).
 * iOS Safari does not support showDirectoryPicker or webkitdirectory.
 * We use navigator.userAgent since capability detection alone isn't reliable
 * (iOS exposes the attribute but silently ignores it).
 */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPad OS 13+ reports as macOS — check for touch + macOS combo
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Matches a Tesla clip filename: YYYY-MM-DD_HH-MM-SS-{camera}.mp4 */
const TESLA_CLIP_RE = /^(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})-([a-z_]+)\.mp4$/i;

/**
 * Wraps a plain File (no webkitRelativePath) with a synthetic
 * "RecentClips/{filename}" path so the parser can classify it correctly.
 * Used on iOS where webkitdirectory is not supported.
 */
function wrapWithFlatPath(file: File): File {
  // Only wrap if the file has no existing path AND matches Tesla naming
  if (file.webkitRelativePath || !TESLA_CLIP_RE.test(file.name)) return file;
  const wrapped = new File([file], file.name, {
    type: file.type,
    lastModified: file.lastModified,
  });
  Object.defineProperty(wrapped, 'webkitRelativePath', {
    value: `RecentClips/${file.name}`,
    writable: false,
  });
  return wrapped;
}

export interface UseFileAccessReturn {
  openFolder: () => void;
  isDragging: boolean;
  handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
}

export function useFileAccess(): UseFileAccessReturn {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadFolder = useEventStore((state) => state.loadFolder);

  // Handle folder/file selection
  const processFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      // On iOS, files arrive without webkitRelativePath — add synthetic path
      const processed = isIOS() ? files.map(wrapWithFlatPath) : files;
      await loadFolder(processed);
    },
    [loadFolder]
  );

  // Open folder/file picker using the best available API
  const openFolder = useCallback(async () => {
    // showDirectoryPicker: Chrome, Edge (not iOS)
    if (!isIOS() && 'showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker();
        const files: File[] = [];

        const collectFiles = async (entry: any, path = '') => {
          for await (const item of entry.values()) {
            const itemPath = path ? `${path}/${item.name}` : item.name;
            if (item.kind === 'file') {
              const file = await item.getFile();
              const newFile = new File([file], itemPath, {
                type: file.type,
                lastModified: file.lastModified,
              });
              Object.defineProperty(newFile, 'webkitRelativePath', {
                value: itemPath,
                writable: false,
              });
              files.push(newFile);
            } else if (item.kind === 'directory') {
              await collectFiles(item, itemPath);
            }
          }
        };

        await collectFiles(dirHandle);
        await processFiles(files);
        return;
      } catch {
        // User cancelled or error — fall through to input method
      }
    }

    // Fallback: hidden <input> (webkitdirectory on desktop, multiple on iOS)
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [processFiles]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      processFiles(files);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [processFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const items = e.dataTransfer.items;
      if (items && items.length > 0) {
        const files: File[] = [];
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.kind === 'file') {
            const file = item.getAsFile();
            if (file) files.push(file);
          }
        }
        if (files.length > 0) await processFiles(files);
      }
    },
    [processFiles]
  );

  return {
    openFolder,
    isDragging,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}

// ── Hidden file input element ──────────────────────────────────────────────────

export function FileInputFallback({
  fileInputRef,
  handleInputChange,
}: {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const ios = isIOS();
  return React.createElement('input', {
    ref: fileInputRef,
    type: 'file',
    // iOS: plain multiple picker (webkitdirectory is silently ignored)
    // Others: folder picker via webkitdirectory
    ...(ios
      ? { multiple: true, accept: 'video/mp4,video/*' }
      : { multiple: true, webkitdirectory: '' }),
    style: { display: 'none' },
    onChange: handleInputChange,
  } as any);
}

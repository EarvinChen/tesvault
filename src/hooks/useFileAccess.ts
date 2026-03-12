'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useEventStore } from '@/stores/event-store';

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

  // Handle folder selection and load files
  const processFiles = useCallback(
    async (files: File[]) => {
      if (files.length > 0) {
        await loadFolder(files);
      }
    },
    [loadFolder]
  );

  // Open folder picker using native APIs
  const openFolder = useCallback(async () => {
    // Try showDirectoryPicker first (Chrome, Edge, etc.)
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker();
        const files: File[] = [];

        // Recursively collect all files from directory
        const collectFiles = async (entry: any, path = '') => {
          for await (const item of entry.values()) {
            const itemPath = path ? `${path}/${item.name}` : item.name;
            if (item.kind === 'file') {
              const file = await item.getFile();
              // Create a new File with webkitRelativePath
              const newFile = new File([file], itemPath, {
                type: file.type,
                lastModified: file.lastModified,
              });
              // Manually set webkitRelativePath property
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
      } catch (err) {
        // User cancelled or error - fall through to input method
        console.log('showDirectoryPicker not available or cancelled');
      }
    }

    // Fallback: use hidden input[webkitdirectory]
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [processFiles]);

  // Handle input change (fallback method)
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      processFiles(files);
      // Reset input for next selection
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [processFiles]
  );

  // Drag and drop handlers
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

        // Handle multiple files/folders
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.kind === 'file') {
            const file = item.getAsFile();
            if (file) {
              files.push(file);
            }
          }
        }

        if (files.length > 0) {
          await processFiles(files);
        }
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
    // Note: fileInputRef is used internally for the hidden input
  };
}

// Export a component to use with the hook
export function FileInputFallback({
  fileInputRef,
  handleInputChange,
}: {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return React.createElement('input', {
    ref: fileInputRef,
    type: 'file',
    multiple: true,
    webkitdirectory: '',
    style: { display: 'none' },
    onChange: handleInputChange,
  } as any);
}

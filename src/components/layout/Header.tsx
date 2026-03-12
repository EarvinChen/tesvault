'use client';

import React, { useRef } from 'react';
import { useFileAccess, FileInputFallback } from '@/hooks/useFileAccess';

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const {
    openFolder,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useFileAccess();

  // Extract the handler for input change from useFileAccess internals
  // We need to handle it through the file input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      // Just opening the folder directly through the hook
      await openFolder();
    }
    // Reset input for next selection
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <FileInputFallback
        fileInputRef={fileInputRef}
        handleInputChange={handleInputChange}
      />

      <header
        className="fixed top-0 left-0 right-0 h-14 bg-[#0a0a0a] border-b border-[#2a2a2a] px-4 flex items-center justify-between z-40"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Left: Logo */}
        <div className="flex items-center gap-2">
          <svg
            className="w-6 h-6 text-blue-500"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-13c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5z" />
          </svg>
          <span className="text-lg font-semibold text-[#e5e5e5] hidden sm:inline">
            TesVault
          </span>
        </div>

        {/* Center: Empty */}
        <div />

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Menu toggle for mobile */}
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 rounded-lg hover:bg-[#1a1a1a] transition-colors text-[#e5e5e5]"
          >
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
            </svg>
          </button>

          {/* Select folder button */}
          <button
            onClick={openFolder}
            className="px-4 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 transition-colors text-white text-sm font-medium"
          >
            選擇資料夾
          </button>
        </div>
      </header>
    </>
  );
}

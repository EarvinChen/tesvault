'use client';

import React from 'react';
import { EventList } from './EventList';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 md:hidden z-30"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed md:static inset-y-0 left-0 w-80 bg-[#0a0a0a] border-r border-[#2a2a2a] flex flex-col z-40 transform transition-transform md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          height: 'calc(100vh - 3.5rem)', // Account for header height
        }}
      >
        <EventList />
      </div>
    </>
  );
}

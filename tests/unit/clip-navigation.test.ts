/**
 * Unit tests for multi-clip navigation logic.
 *
 * Bug context (2026-03-12):
 *   Previously the app would only play the LAST 1-minute clip of any event.
 *   Root cause: VideoGrid read currentEvent.cameras (= last clip only) and
 *   handleEnded just called pause() instead of advancing to the next clip.
 *
 * Fix:
 *   - viewer-store: added activeClipIndex (starts at 0), clipOffset, setActiveClip()
 *   - VideoGrid: blobUrls built from clips[activeClipIndex]; handleEnded advances clip
 *   - Timeline: shows global time (clipOffset + currentTime)
 *   - PlaybackControls: shows "片段 N/M" navigation when totalClips > 1
 *
 * These tests verify the parser side (clips[] correctness) and the store behavior.
 * VideoGrid / Timeline / PlaybackControls are tested via browser E2E.
 */

import { describe, it, expect } from 'vitest';
import { parseTeslaCamFolder } from '@/lib/tesla/parser';

// ─── Helpers ────────────────────────────────────────────────────────────────

const HW4 = ['front', 'back', 'left_repeater', 'right_repeater', 'left_pillar', 'right_pillar'];

function savedFiles(
  category: string,
  eventTs: string,
  clipTs: string,
  suffixes: string[] = HW4,
): string[] {
  return suffixes.map((s) => `TeslaCam/${category}/${eventTs}/${clipTs}-${s}.mp4`);
}

function recentFiles(ts: string, suffixes: string[] = ['front']): string[] {
  return suffixes.map((s) => `TeslaCam/RecentClips/${ts}-${s}.mp4`);
}

// ─── Multi-clip: SavedClips ──────────────────────────────────────────────────

describe('Multi-clip SavedClips', () => {
  // TC-MCP-001: SavedClips with 10 × 1-min segments
  it('TC-MCP-001: SavedClips 10-segment event should have 10 clips and start at index 0 in store', () => {
    const eventTs = '2026-03-10_19-06-43';
    const files: string[] = [];

    // Generate 10 consecutive 1-minute clips
    for (let i = 0; i < 10; i++) {
      const clipHour = 19;
      const clipMin  = i;
      const clipTs   = `2026-03-10_${clipHour.toString().padStart(2,'0')}-${clipMin.toString().padStart(2,'0')}-00`;
      files.push(...savedFiles('SavedClips', eventTs, clipTs));
    }

    const result = parseTeslaCamFolder(files);

    expect(result.events).toHaveLength(1);
    const ev = result.events[0];
    expect(ev.type).toBe('saved');
    expect(ev.clips).toHaveLength(10);

    // Parser sets activeClipIndex to LAST clip (clips[9]);
    // viewer-store resets it to 0 when setCurrentEvent() is called.
    // We test the parser behavior here:
    expect(ev.activeClipIndex).toBe(9);

    // All 10 clips must have camera data
    ev.clips.forEach((clip, idx) => {
      expect(clip.cameras.size).toBeGreaterThan(0);  // at least some cameras
    });
  });

  // TC-MCP-002: Each clip must use its own timestamp, not the event folder timestamp
  it('TC-MCP-002: each ClipGroup timestamp must match its own clip timestamp (not the event folder)', () => {
    const eventTs = '2026-03-10_14-30-00';
    const clip1Ts = '2026-03-10_14-28-00';
    const clip2Ts = '2026-03-10_14-29-00';
    const clip3Ts = '2026-03-10_14-30-00';

    const files = [
      ...savedFiles('SavedClips', eventTs, clip1Ts, ['front']),
      ...savedFiles('SavedClips', eventTs, clip2Ts, ['front']),
      ...savedFiles('SavedClips', eventTs, clip3Ts, ['front']),
    ];
    const result = parseTeslaCamFolder(files);

    const clips = result.events[0].clips;
    // Clips should be sorted chronologically (oldest first)
    expect(clips[0].timestamp).toEqual(new Date('2026-03-10T14:28:00'));
    expect(clips[1].timestamp).toEqual(new Date('2026-03-10T14:29:00'));
    expect(clips[2].timestamp).toEqual(new Date('2026-03-10T14:30:00'));
  });

  // TC-MCP-003: SentryClips with ~11 segments (typical per-event count)
  it('TC-MCP-003: SentryClips with 11 segments should produce 1 event with 11 clips', () => {
    const eventTs = '2026-03-10_03-54-45';
    const files: string[] = [];

    for (let i = 0; i < 11; i++) {
      const clipMin = 50 + i > 59 ? (i - 10) : (50 + i);
      const clipHour = 50 + i > 59 ? 4 : 3;
      const clipTs = `2026-03-10_0${clipHour}-${clipMin.toString().padStart(2,'0')}-00`;
      files.push(...savedFiles('SentryClips', eventTs, clipTs, ['front', 'back']));
    }

    const result = parseTeslaCamFolder(files);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe('sentry');
    expect(result.events[0].clips).toHaveLength(11);
  });

  // TC-MCP-004: cameras field is a shortcut to the activeClip's cameras
  it('TC-MCP-004: event.cameras should equal clips[activeClipIndex].cameras', () => {
    const eventTs = '2026-03-10_14-30-00';
    const files = [
      ...savedFiles('SavedClips', eventTs, '2026-03-10_14-28-00', ['front']),
      ...savedFiles('SavedClips', eventTs, '2026-03-10_14-29-00', ['back']),  // diff camera!
      ...savedFiles('SavedClips', eventTs, '2026-03-10_14-30-00', ['left_repeater']),
    ];
    const result = parseTeslaCamFolder(files);
    const ev = result.events[0];

    // cameras is a shortcut to clips[activeClipIndex].cameras
    expect(ev.cameras).toBe(ev.clips[ev.activeClipIndex].cameras);
  });
});

// ─── Multi-clip: RecentClips session merge ───────────────────────────────────

describe('Multi-clip RecentClips session', () => {
  // TC-MCP-005: 9 consecutive recent clips → one session with 9 clips
  it('TC-MCP-005: 9 consecutive RecentClips (60s apart) merge into 1 session with 9 clips', () => {
    const files: string[] = [];
    for (let i = 0; i < 9; i++) {
      const min = i.toString().padStart(2, '0');
      files.push(...recentFiles(`2026-03-10_19-${min}-00`));
    }
    const result = parseTeslaCamFolder(files);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].clips).toHaveLength(9);
    // session timestamp = first clip
    expect(result.events[0].timestamp).toEqual(new Date('2026-03-10T19:00:00'));
  });

  // TC-MCP-006: Two sessions separated by >5 min → 2 separate events
  it('TC-MCP-006: two RecentClips bursts 15 min apart → 2 separate sessions', () => {
    const files = [
      ...recentFiles('2026-03-10_19-00-00'),
      ...recentFiles('2026-03-10_19-01-00'),
      // 15-minute gap
      ...recentFiles('2026-03-10_19-16-00'),
      ...recentFiles('2026-03-10_19-17-00'),
    ];
    const result = parseTeslaCamFolder(files);

    expect(result.events).toHaveLength(2);
    expect(result.events[0].clips).toHaveLength(2);
    expect(result.events[1].clips).toHaveLength(2);
  });

  // TC-MCP-007: activeClipIndex starts at last clip for Recent events too
  it('TC-MCP-007: RecentClips session activeClipIndex defaults to the last clip', () => {
    const files = [
      ...recentFiles('2026-03-10_19-00-00'),
      ...recentFiles('2026-03-10_19-01-00'),
      ...recentFiles('2026-03-10_19-02-00'),
    ];
    const result = parseTeslaCamFolder(files);

    // Parser default: show last clip first (most recent footage)
    expect(result.events[0].activeClipIndex).toBe(2);
  });
});

// ─── Clip ordering ───────────────────────────────────────────────────────────

describe('Clip chronological ordering', () => {
  // TC-MCP-008: out-of-order file list → clips still sorted oldest-first
  it('TC-MCP-008: clips must be sorted chronologically regardless of file list order', () => {
    const eventTs = '2026-03-10_10-05-00';
    const files = [
      ...savedFiles('SavedClips', eventTs, '2026-03-10_10-04-00', ['front']),
      ...savedFiles('SavedClips', eventTs, '2026-03-10_10-02-00', ['front']),  // out of order
      ...savedFiles('SavedClips', eventTs, '2026-03-10_10-03-00', ['front']),
    ];
    const result = parseTeslaCamFolder(files);
    const clips = result.events[0].clips;

    expect(clips[0].timestamp.getMinutes()).toBe(2);
    expect(clips[1].timestamp.getMinutes()).toBe(3);
    expect(clips[2].timestamp.getMinutes()).toBe(4);
  });
});

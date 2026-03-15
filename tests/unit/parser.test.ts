/**
 * Unit tests for TeslaCam folder parser.
 *
 * All file paths use the ACTUAL HW4 USB naming format verified against a real
 * Tesla USB drive:
 *
 *   RecentClips  — FLAT:   RecentClips/{ts}-{suffix}.mp4
 *   SavedClips   — NESTED: SavedClips/{event-ts}/{clip-ts}-{suffix}.mp4
 *   SentryClips  — NESTED: SentryClips/{event-ts}/{clip-ts}-{suffix}.mp4
 *
 * HW4 camera suffixes on USB:
 *   front, back, left_repeater, right_repeater, left_pillar, right_pillar
 *
 * HW3 camera suffixes (legacy):
 *   front, back, left_repeater, right_repeater
 */

import { describe, it, expect } from 'vitest';
import { parseTeslaCamFolder } from '@/lib/tesla/parser';
import { detectCameraConfig, getCameraLayout, getCameraLabel } from '@/lib/tesla/camera-config';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Flat RecentClips paths (HW4 actual USB format) */
function recentFiles(ts: string, suffixes: string[]): string[] {
  return suffixes.map((s) => `TeslaCam/RecentClips/${ts}-${s}.mp4`);
}

/** Nested SavedClips or SentryClips paths */
function savedFiles(category: string, eventTs: string, clipTs: string, suffixes: string[]): string[] {
  return suffixes.map((s) => `TeslaCam/${category}/${eventTs}/${clipTs}-${s}.mp4`);
}

const HW3_SUFFIXES = ['front', 'back', 'left_repeater', 'right_repeater'];
const HW4_SUFFIXES = [...HW3_SUFFIXES, 'left_pillar', 'right_pillar'];

// ─── parseTeslaCamFolder ───────────────────────────────────────────────────────

describe('parseTeslaCamFolder', () => {
  // TC-U001: 4-camera (HW3) RecentClips — flat structure
  it('TC-U001: should parse 4-camera HW3 RecentClips (flat structure)', () => {
    const files = recentFiles('2025-01-15_10-30-00', HW3_SUFFIXES);
    const result = parseTeslaCamFolder(files);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe('recent');
    expect(result.events[0].cameras.size).toBe(4);
    expect(result.events[0].timestamp).toEqual(new Date('2025-01-15T10:30:00'));
  });

  // TC-U002: 6-camera (HW4) SavedClips — nested structure, left_pillar / right_pillar
  it('TC-U002: should parse 6-camera HW4 SavedClips (nested structure)', () => {
    const files = savedFiles('SavedClips', '2025-06-01_14-00-00', '2025-06-01_13-55-00', HW4_SUFFIXES);
    const result = parseTeslaCamFolder(files);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe('saved');
    expect(result.events[0].cameras.size).toBe(6);
    expect(result.cameraConfig).toBe('SIX_CAMERA');
  });

  // TC-U003: classify RecentClips / SavedClips / SentryClips
  it('TC-U003: should classify RecentClips / SavedClips / SentryClips', () => {
    const files = [
      ...recentFiles('2025-01-15_10-00-00', ['front']),
      ...savedFiles('SavedClips', '2025-01-15_11-00-00', '2025-01-15_10-55-00', ['front']),
      ...savedFiles('SentryClips', '2025-01-15_12-00-00', '2025-01-15_11-55-00', ['front']),
    ];
    const result = parseTeslaCamFolder(files);
    const types = result.events.map((e) => e.type);

    expect(types).toContain('recent');
    expect(types).toContain('saved');
    expect(types).toContain('sentry');
  });

  // TC-U004: empty folder
  it('TC-U004: should handle empty folder gracefully', () => {
    const result = parseTeslaCamFolder([]);
    expect(result.events).toHaveLength(0);
    expect(result.error).toBeUndefined();
  });

  // TC-U005: non-TeslaCam folder → structured error
  it('TC-U005: non-TeslaCam folder should return INVALID_FOLDER_STRUCTURE error', () => {
    const result = parseTeslaCamFolder(['Documents/resume.pdf', 'Photos/vacation.jpg']);
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe('INVALID_FOLDER_STRUCTURE');
  });

  // TC-U006: partial cameras — isComplete should be false
  it('TC-U006: should handle missing camera files gracefully and mark isComplete=false', () => {
    const files = recentFiles('2025-01-15_10-30-00', ['front', 'left_repeater']);
    const result = parseTeslaCamFolder(files);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].cameras.size).toBe(2);
    expect(result.events[0].isComplete).toBe(false);
  });

  // TC-U007: events > 5 min apart → separate sessions, sorted newest-first
  it('TC-U007: should create separate sessions for clips >5 min apart and sort newest-first', () => {
    // Clips are 2 hours apart → 3 independent sessions
    const files = [
      ...recentFiles('2025-01-15_10-00-00', ['front']),
      ...recentFiles('2025-01-15_08-00-00', ['front']),
      ...recentFiles('2025-01-15_12-00-00', ['front']),
    ];
    const result = parseTeslaCamFolder(files);

    expect(result.events).toHaveLength(3);
    expect(result.events[0].timestamp.getHours()).toBe(12);
    expect(result.events[2].timestamp.getHours()).toBe(8);
  });

  // TC-U021: RecentClips ≤5-min gap → merged into one session (key UX fix)
  it('TC-U021: RecentClips within 5-minute gap should merge into one driving session', () => {
    // 3 consecutive 1-minute clips (60 s gap each)
    const files = [
      ...recentFiles('2025-01-15_10-00-00', ['front']),
      ...recentFiles('2025-01-15_10-01-00', ['front']),
      ...recentFiles('2025-01-15_10-02-00', ['front']),
    ];
    const result = parseTeslaCamFolder(files);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].clips).toHaveLength(3);
    expect(result.events[0].timestamp).toEqual(new Date('2025-01-15T10:00:00'));
  });

  // TC-U022: RecentClips >5-min gap → split into separate sessions
  it('TC-U022: RecentClips with >5-minute gap should create separate sessions', () => {
    const files = [
      ...recentFiles('2025-01-15_10-00-00', ['front']),
      ...recentFiles('2025-01-15_10-10-00', ['front']),
    ];
    const result = parseTeslaCamFolder(files);
    expect(result.events).toHaveLength(2);
  });

  // TC-U023: SavedClips multi-segment event — activeClipIndex = last segment
  it('TC-U023: SavedClips with multiple 1-min segments should produce one event, activeClipIndex = last', () => {
    const eventTs = '2025-03-10_14-30-00';
    const files = [
      ...savedFiles('SavedClips', eventTs, '2025-03-10_14-28-00', ['front', 'back']),
      ...savedFiles('SavedClips', eventTs, '2025-03-10_14-29-00', ['front', 'back']),
      ...savedFiles('SavedClips', eventTs, '2025-03-10_14-30-00', ['front', 'back']),
    ];
    const result = parseTeslaCamFolder(files);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].clips).toHaveLength(3);
    expect(result.events[0].activeClipIndex).toBe(2); // last clip = closest to save time
  });

  // TC-U024: HW4 left_pillar / right_pillar → internal left_rear / right_rear
  it('TC-U024: HW4 left_pillar/right_pillar suffixes should map to left_rear/right_rear positions', () => {
    const files = savedFiles(
      'SavedClips',
      '2026-01-25_13-56-30',
      '2026-01-25_13-45-59',
      ['left_pillar', 'right_pillar'],
    );
    const result = parseTeslaCamFolder(files);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].cameras.has('left_rear')).toBe(true);
    expect(result.events[0].cameras.has('right_rear')).toBe(true);
  });
});

// ─── detectCameraConfig ────────────────────────────────────────────────────────

describe('detectCameraConfig', () => {
  // TC-U008: HW3 4-camera
  it('TC-U008: should detect FOUR_CAMERA from HW3 suffixes', () => {
    expect(detectCameraConfig(['front', 'back', 'left_repeater', 'right_repeater']))
      .toBe('FOUR_CAMERA');
  });

  // TC-U009: HW4 6-camera with actual USB suffixes
  it('TC-U009: should detect SIX_CAMERA from HW4 USB suffixes (left_pillar / right_pillar)', () => {
    expect(
      detectCameraConfig(['front', 'back', 'left_repeater', 'right_repeater', 'left_pillar', 'right_pillar']),
    ).toBe('SIX_CAMERA');
  });

  // TC-U009b: legacy left_rear / right_rear aliases also detected as SIX_CAMERA
  it('TC-U009b: should detect SIX_CAMERA from legacy left_rear / right_rear suffixes', () => {
    expect(
      detectCameraConfig(['front', 'back', 'left_repeater', 'right_repeater', 'left_rear', 'right_rear']),
    ).toBe('SIX_CAMERA');
  });

  // TC-U010: unknown → UNKNOWN
  it('TC-U010: unknown suffix list should return UNKNOWN', () => {
    expect(detectCameraConfig(['unknown_cam'])).toBe('UNKNOWN');
  });

  // TC-U010b: full filenames with timestamp prefix and .mp4 should be normalized
  it('TC-U010b: should accept full filenames and strip timestamp + .mp4', () => {
    expect(
      detectCameraConfig(['2026-03-10_18-05-36-front.mp4', '2026-03-10_18-05-36-back.mp4']),
    ).toBe('FOUR_CAMERA');
  });
});

// ─── getCameraLayout & getCameraLabel ─────────────────────────────────────────

describe('Camera Config helpers', () => {
  it('TC-U018: FOUR_CAMERA should return 2×2 layout', () => {
    const layout = getCameraLayout('FOUR_CAMERA');
    expect(layout.rows).toBe(2);
    expect(layout.cols).toBe(2);
  });

  it('TC-U019: SIX_CAMERA should return 2×3 layout', () => {
    const layout = getCameraLayout('SIX_CAMERA');
    expect(layout.rows).toBe(2);
    expect(layout.cols).toBe(3);
  });

  it('TC-U020: camera labels should match HW4 6-camera configuration', () => {
    expect(getCameraLabel('front',       'zh-TW')).toBe('前');
    expect(getCameraLabel('front',       'en')).toBe('Front');
    expect(getCameraLabel('back',        'zh-TW')).toBe('後');
    expect(getCameraLabel('left_front',  'zh-TW')).toBe('左前');
    expect(getCameraLabel('right_front', 'zh-TW')).toBe('右前');
    expect(getCameraLabel('left_rear',   'zh-TW')).toBe('左後');
    expect(getCameraLabel('right_rear',  'zh-TW')).toBe('右後');
  });
});

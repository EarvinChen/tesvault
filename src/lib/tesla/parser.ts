import type {
  TeslaCamEvent,
  ClipGroup,
  EventType,
  ParseResult,
  CameraPosition,
  VideoFile,
  SentryTrigger,
} from '@/types/tesla';
import { CAMERA_SUFFIX_TO_POSITION, detectCameraConfig } from './camera-config';

// === Constants ===

const CATEGORY_MAP: Record<string, EventType> = {
  RecentClips:  'recent',
  SavedClips:   'saved',
  SentryClips:  'sentry',
};

/**
 * Matches a TeslaCam clip filename.
 *
 * Format: {YYYY-MM-DD_HH-MM-SS}-{cameraSuffix}.mp4
 * Examples:
 *   2026-03-10_18-05-36-front.mp4
 *   2026-01-28_12-40-57-left_pillar.mp4
 *
 * Capture groups:
 *   [1] timestamp — "2026-03-10_18-05-36"
 *   [2] suffix    — "front" | "left_pillar" | "left_repeater" …
 */
const CLIP_FILE_RE =
  /^(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})-([a-z_]+)\.mp4$/i;

/** Bare timestamp folder/segment: "YYYY-MM-DD_HH-MM-SS" */
const TIMESTAMP_FOLDER_RE = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/;

/**
 * Maximum gap (ms) between consecutive RecentClips to still be considered
 * the same driving session. Clips ≤ this gap apart are merged.
 * Tesla records in 1-minute segments; typical gap between clips is ~1 s.
 * A gap > 5 min means the car was likely parked/off between segments.
 */
const SESSION_GAP_MS = 5 * 60 * 1000; // 5 minutes

// === Helpers ===

function parseFolderTimestamp(ts: string): Date | null {
  if (!TIMESTAMP_FOLDER_RE.test(ts)) return null;
  const [datePart, timePart] = ts.split('_');
  const iso = `${datePart}T${timePart.replace(/-/g, ':')}`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function splitPath(p: string): string[] {
  return p.replace(/\\/g, '/').split('/').filter(Boolean);
}

function reasonToTrigger(reason: string): SentryTrigger {
  if (reason.includes('motion'))    return 'motion';
  if (reason.includes('impact'))    return 'impact';
  if (reason.includes('glass'))     return 'glass_break';
  if (reason.includes('proximity')) return 'proximity';
  return 'unknown';
}

// === Intermediate structures ===

interface ClipFileEntry {
  clipTimestamp: string;
  cameraSuffix:  string;
  cameraPos:     CameraPosition;
  originalInput: string | File;
}

interface EventAccumulator {
  type:            EventType;
  /** For saved/sentry: the event-folder timestamp. For recent: same as the clip timestamp (unused for grouping). */
  displayTs:       string;
  clips:           Map<string, ClipFileEntry[]>; // key = clipTimestamp
  thumbnailPath?:  string | File;
  eventJsonInput?: string | File;
}

// === Main Parser ===

export function parseTeslaCamFolder(input: (string | File)[]): ParseResult {
  if (!input || input.length === 0) {
    return { events: [], cameraConfig: 'UNKNOWN' };
  }

  // Normalize to path strings
  const filePaths = input.map((f) =>
    typeof f === 'string' ? f : ((f as File).webkitRelativePath || (f as File).name)
  );

  // Sanity-check: ensure at least one known category folder exists
  const hasTeslaCamStructure = filePaths.some((p) =>
    splitPath(p).some((s) => s in CATEGORY_MAP)
  );

  if (!hasTeslaCamStructure) {
    return {
      events: [],
      cameraConfig: 'UNKNOWN',
      error: {
        code: 'INVALID_FOLDER_STRUCTURE',
        message: '找不到 TeslaCam 資料夾結構 (RecentClips / SavedClips / SentryClips)',
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // First pass: accumulate all file entries by event key.
  //
  // For RecentClips: single accumulator with key = "recent_ALL" (we'll split
  //   into sessions in a second pass).
  // For SavedClips / SentryClips: one accumulator per event folder.
  // ─────────────────────────────────────────────────────────────────────────
  const eventMap = new Map<string, EventAccumulator>();

  for (let i = 0; i < filePaths.length; i++) {
    const segs = splitPath(filePaths[i]);

    let catIdx = -1;
    let eventType: EventType | null = null;
    for (let j = 0; j < segs.length; j++) {
      if (segs[j] in CATEGORY_MAP) {
        catIdx = j;
        eventType = CATEGORY_MAP[segs[j]];
        break;
      }
    }
    if (catIdx === -1 || !eventType) continue;

    const afterCat = segs.slice(catIdx + 1);

    // ── RecentClips (FLAT structure) ─────────────────────────────────────
    // e.g. RecentClips/2026-03-10_18-05-36-front.mp4
    if (eventType === 'recent') {
      if (afterCat.length !== 1) continue;

      const m = CLIP_FILE_RE.exec(afterCat[0]);
      if (!m) continue;

      const [, clipTs, suffix] = m;
      const cameraPos = CAMERA_SUFFIX_TO_POSITION[suffix];
      if (!cameraPos) continue;

      // All recent clips share one accumulator; sessions are split later.
      const key = 'recent_ALL';
      if (!eventMap.has(key)) {
        eventMap.set(key, { type: 'recent', displayTs: clipTs, clips: new Map() });
      }
      const acc = eventMap.get(key)!;
      if (!acc.clips.has(clipTs)) acc.clips.set(clipTs, []);
      acc.clips.get(clipTs)!.push({ clipTimestamp: clipTs, cameraSuffix: suffix, cameraPos, originalInput: input[i] });
      continue;
    }

    // ── SavedClips / SentryClips (NESTED structure) ──────────────────────
    // e.g. SavedClips/2026-01-25_13-56-30/2026-01-25_13-45-59-front.mp4
    if (afterCat.length < 2) continue;

    const folderName = afterCat[0];
    if (!TIMESTAMP_FOLDER_RE.test(folderName)) continue;

    const fileName = afterCat[1];
    const key = `${eventType}/${folderName}`;

    if (!eventMap.has(key)) {
      eventMap.set(key, { type: eventType, displayTs: folderName, clips: new Map() });
    }
    const acc = eventMap.get(key)!;

    if (fileName === 'thumb.png')   { acc.thumbnailPath  = input[i]; continue; }
    if (fileName === 'event.json')  { acc.eventJsonInput = input[i]; continue; }

    const m = CLIP_FILE_RE.exec(fileName);
    if (!m) continue;

    const [, clipTs, suffix] = m;
    const cameraPos = CAMERA_SUFFIX_TO_POSITION[suffix];
    if (!cameraPos) continue;

    if (!acc.clips.has(clipTs)) acc.clips.set(clipTs, []);
    acc.clips.get(clipTs)!.push({ clipTimestamp: clipTs, cameraSuffix: suffix, cameraPos, originalInput: input[i] });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Detect camera configuration from all seen camera suffixes.
  // ─────────────────────────────────────────────────────────────────────────
  const allSuffixes: string[] = [];
  for (const acc of eventMap.values()) {
    for (const entries of acc.clips.values()) {
      for (const e of entries) allSuffixes.push(e.cameraSuffix);
    }
  }
  const cameraConfig = detectCameraConfig(allSuffixes);
  const expectedCount = cameraConfig === 'SIX_CAMERA' ? 6 : 4;

  // ─────────────────────────────────────────────────────────────────────────
  // Second pass: build TeslaCamEvent objects.
  // ─────────────────────────────────────────────────────────────────────────
  const events: TeslaCamEvent[] = [];

  for (const [mapKey, acc] of eventMap) {
    if (mapKey === 'recent_ALL') {
      // ── RecentClips: split into driving sessions ─────────────────────
      const sessionEvents = buildRecentSessions(acc, expectedCount);
      events.push(...sessionEvents);
    } else {
      // ── SavedClips / SentryClips: one event per folder ───────────────
      const ev = buildSingleEvent(acc, expectedCount);
      if (ev) events.push(ev);
    }
  }

  // Sort newest first
  events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return { events, cameraConfig };
}

// ─────────────────────────────────────────────────────────────────────────────
// Build helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert an EventAccumulator's clip entries for one timestamp into a ClipGroup.
 */
function buildClipGroup(
  clipTs: string,
  entries: ClipFileEntry[]
): ClipGroup | null {
  const tsDate = parseFolderTimestamp(clipTs);
  if (!tsDate) return null;

  const cameras = new Map<CameraPosition, VideoFile>();
  for (const entry of entries) {
    const file =
      typeof entry.originalInput === 'string'
        ? new File([], entry.originalInput)
        : (entry.originalInput as File);

    cameras.set(entry.cameraPos, {
      camera:   entry.cameraPos,
      file,
      size:     file.size,
      hasAudio: entry.cameraPos === 'front',
    });
  }

  return { timestamp: tsDate, cameras };
}

/**
 * Build multiple TeslaCamEvents from a RecentClips accumulator by grouping
 * consecutive 1-minute clips that are within SESSION_GAP_MS of each other.
 */
function buildRecentSessions(
  acc: EventAccumulator,
  expectedCount: number
): TeslaCamEvent[] {
  // Sort all clip timestamps chronologically
  const sortedTs = Array.from(acc.clips.keys()).sort();
  if (sortedTs.length === 0) return [];

  // Group into sessions: start a new session when gap > SESSION_GAP_MS
  const sessions: string[][] = [];
  let currentSession: string[] = [];

  for (let i = 0; i < sortedTs.length; i++) {
    if (currentSession.length === 0) {
      currentSession.push(sortedTs[i]);
    } else {
      const prevDate = parseFolderTimestamp(currentSession[currentSession.length - 1]);
      const currDate = parseFolderTimestamp(sortedTs[i]);
      if (prevDate && currDate && currDate.getTime() - prevDate.getTime() <= SESSION_GAP_MS) {
        currentSession.push(sortedTs[i]);
      } else {
        sessions.push(currentSession);
        currentSession = [sortedTs[i]];
      }
    }
  }
  if (currentSession.length > 0) sessions.push(currentSession);

  // Build one TeslaCamEvent per session
  const events: TeslaCamEvent[] = [];

  for (const session of sessions) {
    const clipGroups: ClipGroup[] = [];
    let totalSize = 0;

    for (const clipTs of session) {
      const entries = acc.clips.get(clipTs)!;
      const group = buildClipGroup(clipTs, entries);
      if (!group) continue;
      clipGroups.push(group);
      for (const vf of group.cameras.values()) totalSize += vf.size;
    }

    if (clipGroups.length === 0) continue;

    const firstTs = parseFolderTimestamp(session[0])!;
    // Default to the last clip (most recent footage) for initial display
    const activeClipIndex = clipGroups.length - 1;

    events.push({
      id:               `recent-${session[0]}`,
      type:             'recent',
      timestamp:        firstTs,
      folderName:       session[0],
      cameras:          clipGroups[activeClipIndex].cameras,
      clips:            clipGroups,
      activeClipIndex,
      totalSize,
      isComplete:       clipGroups[activeClipIndex].cameras.size >= expectedCount,
    });
  }

  return events;
}

/**
 * Build a single TeslaCamEvent from a SavedClips or SentryClips accumulator.
 */
function buildSingleEvent(
  acc: EventAccumulator,
  expectedCount: number
): TeslaCamEvent | null {
  const displayTs = parseFolderTimestamp(acc.displayTs);
  if (!displayTs) return null;

  const sortedTs = Array.from(acc.clips.keys()).sort();
  if (sortedTs.length === 0) return null;

  const clipGroups: ClipGroup[] = [];
  let totalSize = 0;

  for (const clipTs of sortedTs) {
    const entries = acc.clips.get(clipTs)!;
    const group = buildClipGroup(clipTs, entries);
    if (!group) continue;
    clipGroups.push(group);
    for (const vf of group.cameras.values()) totalSize += vf.size;
  }

  if (clipGroups.length === 0) return null;

  // Default to last clip (clip just before save/trigger event)
  const activeClipIndex = clipGroups.length - 1;

  let sentryTrigger: SentryTrigger | undefined;
  let location: TeslaCamEvent['location'] | undefined;

  // Sync parse event.json only if input is a plain string (test mode)
  if (typeof acc.eventJsonInput === 'string') {
    try {
      const json = JSON.parse(acc.eventJsonInput as string);
      sentryTrigger = reasonToTrigger(json.reason || '');
      const lat = parseFloat(json.est_lat);
      const lon = parseFloat(json.est_lon);
      if (!isNaN(lat) && !isNaN(lon)) {
        location = { lat, lon, street: json.street || undefined, city: json.city || undefined };
      }
    } catch { /* ignore */ }
  }

  const typePrefix = acc.type === 'sentry' ? 'sentry' : 'saved';

  return {
    id:               `${typePrefix}-${acc.displayTs}`,
    type:             acc.type,
    timestamp:        displayTs,
    folderName:       acc.displayTs,
    cameras:          clipGroups[activeClipIndex].cameras,
    clips:            clipGroups,
    activeClipIndex,
    totalSize,
    isComplete:       clipGroups[activeClipIndex].cameras.size >= expectedCount,
    sentryTrigger,
    location,
    thumbnailUrl:     undefined,
  };
}

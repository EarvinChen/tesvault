// === Camera Types ===

/** Tesla camera positions - variable names used in code */
export type CameraPosition =
  | 'front'       // 前 — front main camera
  | 'back'        // 後 — rear camera
  | 'left_front'  // 左前 — B-pillar left (file suffix: left_repeater)
  | 'right_front' // 右前 — B-pillar right (file suffix: right_repeater)
  | 'left_rear'   // 左後 — pillar left (file suffix: left_pillar, HW4 only)
  | 'right_rear'; // 右後 — pillar right (file suffix: right_pillar, HW4 only)

/** Camera hardware configuration */
export type CameraConfigType = 'FOUR_CAMERA' | 'SIX_CAMERA' | 'UNKNOWN';

/** Layout arrangement preference */
export type CameraArrangement = 'left_right' | 'right_left';

// === Event Types ===

export type EventType = 'recent' | 'saved' | 'sentry';

export type SentryTrigger = 'motion' | 'impact' | 'glass_break' | 'proximity' | 'unknown';

// === Data Interfaces ===

export interface VideoFile {
  camera: CameraPosition;
  file: File;
  blobUrl?: string;
  duration?: number;
  size: number;
  hasAudio: boolean;
}

/** A single 1-minute clip segment (one set of camera files) */
export interface ClipGroup {
  /** Recording start time of this 1-minute clip */
  timestamp: Date;
  cameras: Map<CameraPosition, VideoFile>;
}

export interface TeslaCamEvent {
  id: string;
  type: EventType;
  /** For saved/sentry: the save/trigger timestamp (folder name). For recent: the clip timestamp. */
  timestamp: Date;
  folderName: string;
  /** Shortcut to the active clip's cameras (= clips[activeClipIndex].cameras) */
  cameras: Map<CameraPosition, VideoFile>;
  /** All 1-minute clip segments in this event (1 for recent, multiple for saved/sentry) */
  clips: ClipGroup[];
  /** Which clip is currently displayed */
  activeClipIndex: number;
  thumbnailUrl?: string;
  duration?: number;
  totalSize: number;
  isComplete: boolean;
  sentryTrigger?: SentryTrigger;
  /** GPS location from event.json */
  location?: { lat: number; lon: number; street?: string; city?: string };
}

export interface ParseResult {
  events: TeslaCamEvent[];
  cameraConfig: CameraConfigType;
  error?: ParseError;
}

export interface ParseError {
  code: 'INVALID_FOLDER_STRUCTURE' | 'EMPTY_FOLDER' | 'UNKNOWN_ERROR';
  message: string;
}

// === Viewer State ===

export interface ViewerState {
  currentEvent: TeslaCamEvent | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  volume: number;
  isMuted: boolean;
  activeCameras: CameraPosition[];
  focusedCamera: CameraPosition | null;
  layoutMode: 'grid' | 'focus';
  cameraCount: 4 | 6;
}

// === Event Store State ===

export interface EventStoreState {
  events: TeslaCamEvent[];
  activeFilter: 'all' | EventType;
  sortOrder: 'newest' | 'oldest';
  isLoading: boolean;
  error: string | null;
  cameraConfig: CameraConfigType;
}

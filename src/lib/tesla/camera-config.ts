import type { CameraPosition, CameraConfigType } from '@/types/tesla';

// === Camera Configurations ===

/** HW3 vehicles (2020-2023): 4 cameras */
export const FOUR_CAMERA_POSITIONS: CameraPosition[] = [
  'front', 'back', 'left_front', 'right_front',
];

/** HW4 vehicles (2024+): 6 cameras */
export const SIX_CAMERA_POSITIONS: CameraPosition[] = [
  'front', 'back', 'left_front', 'right_front', 'left_rear', 'right_rear',
];

// === File Name Suffix Mapping ===
// Tesla USB files are named: {timestamp}-{cameraSuffix}.mp4
// This maps the cameraSuffix (after the last timestamp) to our internal CameraPosition.
//
// Actual HW4 file suffixes observed on USB:
//   front, back, left_repeater, right_repeater, left_pillar, right_pillar
//
// Legacy HW3/early HW4 suffix names also kept for compatibility:
//   left_rear, right_rear

export const CAMERA_SUFFIX_TO_POSITION: Record<string, CameraPosition> = {
  'front':           'front',
  'back':            'back',
  'left_repeater':   'left_front',
  'right_repeater':  'right_front',
  'left_pillar':     'left_rear',   // HW4 actual USB suffix
  'right_pillar':    'right_rear',  // HW4 actual USB suffix
  // Legacy / alternative suffixes
  'left_rear':       'left_rear',
  'right_rear':      'right_rear',
};

// Keep FILE_TO_CAMERA as alias for backward compatibility with tests
export const FILE_TO_CAMERA: Record<string, CameraPosition> = CAMERA_SUFFIX_TO_POSITION;

export const CAMERA_TO_FILE: Record<CameraPosition, string> = {
  front:       'front',
  back:        'back',
  left_front:  'left_repeater',
  right_front: 'right_repeater',
  left_rear:   'left_pillar',
  right_rear:  'right_pillar',
};

// === Labels ===

const LABELS_ZH: Record<CameraPosition, string> = {
  front:       '前',
  back:        '後',
  left_front:  '左前',
  right_front: '右前',
  left_rear:   '左後',
  right_rear:  '右後',
};

const LABELS_EN: Record<CameraPosition, string> = {
  front:       'Front',
  back:        'Back',
  left_front:  'Left Front',
  right_front: 'Right Front',
  left_rear:   'Left Rear',
  right_rear:  'Right Rear',
};

export function getCameraLabel(
  camera: CameraPosition,
  locale: 'zh-TW' | 'en' = 'zh-TW'
): string {
  return locale === 'zh-TW' ? LABELS_ZH[camera] : LABELS_EN[camera];
}

// === Layout ===

export interface CameraLayout {
  rows: number;
  cols: number;
  positions: CameraPosition[];
}

export function getCameraLayout(config: CameraConfigType): CameraLayout {
  if (config === 'SIX_CAMERA') {
    return { rows: 2, cols: 3, positions: SIX_CAMERA_POSITIONS };
  }
  return { rows: 2, cols: 2, positions: FOUR_CAMERA_POSITIONS };
}

// === Detection ===

/**
 * Detect camera config from a list of camera suffix names (or legacy .mp4 filenames).
 * Accepts either plain suffix strings (e.g. "left_pillar") or full filenames (e.g. "left_rear.mp4").
 */
export function detectCameraConfig(suffixesOrFileNames: string[]): CameraConfigType {
  // Normalize: strip .mp4 extension and any timestamp prefix if present
  const suffixes = suffixesOrFileNames.map((s) => {
    // Remove .mp4
    let name = s.endsWith('.mp4') ? s.slice(0, -4) : s;
    // Remove timestamp prefix pattern: YYYY-MM-DD_HH-MM-SS-
    name = name.replace(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-/, '');
    return name;
  });

  const cameras = new Set(
    suffixes
      .map((s) => CAMERA_SUFFIX_TO_POSITION[s])
      .filter(Boolean)
  );

  const hasHW4Only = cameras.has('left_rear') || cameras.has('right_rear');
  if (hasHW4Only) return 'SIX_CAMERA';

  const hasFront = cameras.has('front');
  const hasBack = cameras.has('back');
  const hasLeft = cameras.has('left_front');
  const hasRight = cameras.has('right_front');

  if (hasFront && (hasBack || hasLeft || hasRight)) return 'FOUR_CAMERA';

  return 'UNKNOWN';
}

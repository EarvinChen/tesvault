/**
 * Fast video export using canvas.captureStream() + MediaRecorder.
 *
 * Why faster than FFmpeg.wasm:
 *   MediaRecorder calls the browser's native hardware video encoder
 *   (VideoToolbox on Apple, Media Foundation on Windows, VA-API on Linux).
 *   No WASM sandbox overhead, no software-only libx264.
 *
 * Speed:
 *   Plays at PLAYBACK_RATE = 1 (real-time) to ensure correct output speed.
 *   A 60-second clip encodes in ~60 seconds — still ~20× faster than FFmpeg.wasm
 *   which needs 20+ minutes for six-camera 1280×1440.
 *
 * Aspect ratio:
 *   Tesla HW4 cameras are 724:469 (≈ 1.543:1, close to 3:2).
 *   Canvas cells are sized to match this ratio exactly — no stretching.
 *   Six-camera output: 1280 × 2486.
 *
 * Watermark:
 *   Bottom-right of each exported frame: "TesVault" brand + clip timestamp.
 *   Drawn on canvas after each frame composite.
 *
 * No audio:
 *   Tesla cameras do not record audio. Greatly simplifies implementation.
 *
 * Compatibility:
 *   - Chrome 74+: MP4 (H.264) or WebM (VP9)
 *   - Safari 14.1+ / iOS 14.5+: MP4 (H.264)
 *   - Firefox 101+: WebM (VP9)
 */

import type { ExportOptions } from './export';
import type { CameraPosition } from '@/types/tesla';

// Play at 1× to ensure correct output speed.
// (Previous 4× trick caused output to play back 4× too fast.)
const PLAYBACK_RATE = 1;

// Output frame rate fed to MediaRecorder via captureStream.
const CAPTURE_FPS = 30;

// Tesla HW4 actual aspect ratio: 2896×1876 (front) / 1448×938 (others) = 724:469
const CAM_AR_W = 724;
const CAM_AR_H = 469;

// ─── Capability detection ──────────────────────────────────────────────────────

/**
 * Returns true when the browser supports canvas MediaRecorder export.
 * This is available on Safari 14.1+, Chrome 74+, Firefox 101+.
 */
export function isCanvasExportSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    'captureStream' in HTMLCanvasElement.prototype
  );
}

/**
 * Best MIME type for the current browser.
 * Prefers H.264 MP4 (works on iPhone / QuickTime), falls back to WebM.
 */
function getBestMimeType(): string {
  const candidates = [
    'video/mp4; codecs=avc1.42E01E', // H.264 Baseline — widest iOS compat
    'video/mp4; codecs=avc1',
    'video/mp4',
    'video/webm; codecs=vp9',
    'video/webm; codecs=vp8',
    'video/webm',
  ];
  for (const t of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t;
  }
  return 'video/webm';
}

// ─── Canvas layout geometry ────────────────────────────────────────────────────
// Cell heights are calculated from actual Tesla HW4 aspect ratio (724:469 ≈ 1.543:1).
//
// Six-camera layout (1280 × 2486):
//   front       1280 × 829   (full width)
//   left_front   640 × 414   (half width)   right_front  640 × 414
//   left_rear    640 × 414                  right_rear   640 × 414
//   back        1280 × 829   (full width)
//
// Formula: h = round(w × CAM_AR_H / CAM_AR_W)

const FULL_W  = 1280;
const HALF_W  = 640;
const FULL_H  = Math.round(FULL_W * CAM_AR_H / CAM_AR_W);   // 829
const HALF_H  = Math.round(HALF_W * CAM_AR_H / CAM_AR_W);   // 414

interface CamRect { cam: CameraPosition; x: number; y: number; w: number; h: number }
interface CanvasLayout { outW: number; outH: number; rects: CamRect[] }

function buildCanvasLayout(layout: 'single' | 'quad' | 'six', singleCamera: CameraPosition): CanvasLayout {
  switch (layout) {
    case 'single':
      return {
        outW: FULL_W, outH: FULL_H,
        rects: [{ cam: singleCamera, x: 0, y: 0, w: FULL_W, h: FULL_H }],
      };

    case 'quad': {
      // 2×2 grid at correct aspect ratio: 1280 × (829 + 414) = 1280 × 1243
      // Top row: front | left_front; Bottom row: back | right_front
      const rowH = HALF_H;
      return {
        outW: FULL_W, outH: FULL_H + rowH,
        rects: [
          { cam: 'front',       x:       0, y:     0, w: HALF_W, h: FULL_H },
          { cam: 'left_front',  x: HALF_W, y:     0, w: HALF_W, h: FULL_H },
          { cam: 'back',        x:       0, y: FULL_H, w: HALF_W, h: rowH  },
          { cam: 'right_front', x: HALF_W, y: FULL_H, w: HALF_W, h: rowH  },
        ],
      };
    }

    case 'six': {
      // Camzy-style vertical stack: front / (lf|rf) / (lr|rr) / back
      const outH = FULL_H + HALF_H + HALF_H + FULL_H;
      return {
        outW: FULL_W,
        outH,
        rects: [
          { cam: 'front',       x:       0, y: 0,                          w: FULL_W, h: FULL_H },
          { cam: 'left_front',  x:       0, y: FULL_H,                     w: HALF_W, h: HALF_H },
          { cam: 'right_front', x: HALF_W, y: FULL_H,                     w: HALF_W, h: HALF_H },
          { cam: 'left_rear',   x:       0, y: FULL_H + HALF_H,            w: HALF_W, h: HALF_H },
          { cam: 'right_rear',  x: HALF_W, y: FULL_H + HALF_H,            w: HALF_W, h: HALF_H },
          { cam: 'back',        x:       0, y: FULL_H + HALF_H + HALF_H,  w: FULL_W, h: FULL_H },
        ],
      };
    }
  }
}

// ─── Watermark ─────────────────────────────────────────────────────────────────

function drawWatermark(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  clipTime: number,              // seconds elapsed since startTime
  startTime: number,             // clip startTime offset (seconds)
  eventTimestamp: Date | null,   // actual recording date from event metadata
) {
  const pad  = 14;
  const size = Math.max(18, Math.round(canvasH * 0.012)); // scales with output height

  // Compute display time string
  // If we have the event's recording timestamp, show real date+time (YYYY-MM-DD HH:MM:SS).
  // Otherwise fall back to clip-relative M:SS.
  let timeStr: string;
  if (eventTimestamp) {
    const ms = eventTimestamp.getTime() + (startTime + clipTime) * 1000;
    const d  = new Date(ms);
    const yyyy = d.getFullYear();
    const mo   = String(d.getMonth() + 1).padStart(2, '0');
    const dd   = String(d.getDate()).padStart(2, '0');
    const hh   = String(d.getHours()).padStart(2, '0');
    const mi   = String(d.getMinutes()).padStart(2, '0');
    const ss   = String(d.getSeconds()).padStart(2, '0');
    timeStr = `${yyyy}-${mo}-${dd}  ${hh}:${mi}:${ss}`;
  } else {
    const totalSecs = Math.floor(startTime + clipTime);
    const mm = Math.floor(totalSecs / 60);
    const ss = String(totalSecs % 60).padStart(2, '0');
    timeStr = `${mm}:${ss}`;
  }

  const label = `TesVault  ${timeStr}`;

  ctx.save();
  ctx.font = `600 ${size}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign  = 'right';
  ctx.textBaseline = 'bottom';

  // Shadow for readability on any background
  ctx.shadowColor   = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur    = 4;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;

  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(label, canvasW - pad, canvasH - pad);
  ctx.restore();
}

// ─── Main export ───────────────────────────────────────────────────────────────

/**
 * Export video via canvas capture — no FFmpeg.wasm required.
 * Accepts the same ExportOptions as exportVideo() for drop-in use.
 */
export async function exportVideoCanvas(options: ExportOptions): Promise<void> {
  const {
    layout, singleCamera, blobUrls, startTime, endTime,
    eventTimestamp,
    onPhase, onProgress, onComplete, onError,
  } = options;

  const duration = endTime - startTime;
  const canvasLayout = buildCanvasLayout(layout, singleCamera);

  // Only include cameras for which we have a blob URL
  const activeRects = canvasLayout.rects.filter(r => !!blobUrls[r.cam]);
  if (activeRects.length === 0) {
    onError(new Error('選定佈局中沒有可用的鏡頭影片'));
    return;
  }

  onPhase('preparing');
  onProgress(0);

  // Container for video elements used during encoding.
  // IMPORTANT: Must stay inside the viewport (not at -9999px) to prevent Chrome from
  // throttling off-screen media elements — throttling causes the export to take 5× too long
  // and MediaRecorder records 5× the expected duration.
  // We use opacity:0.001 + z-index:-9999 to make it invisible to users while staying on-screen.
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;overflow:visible;pointer-events:none;opacity:0.001;z-index:-9999;';
  document.body.appendChild(container);

  try {
    // ── 1. Create + load hidden video elements ─────────────────────────────
    const videoEls = new Map<CameraPosition, HTMLVideoElement>();

    await Promise.all(activeRects.map(({ cam }) =>
      new Promise<void>((resolve, reject) => {
        const vid = document.createElement('video');
        vid.src = blobUrls[cam]!;
        vid.muted = true;
        vid.playsInline = true;
        vid.preload = 'auto';
        vid.style.cssText = 'width:2px;height:2px;object-fit:fill;';
        container.appendChild(vid);
        videoEls.set(cam, vid);
        vid.onloadeddata = () => resolve();
        vid.onerror = () => reject(new Error(`無法載入鏡頭影片：${cam}`));
        vid.load();
      })
    ));

    // ── 2. Seek all videos to startTime ───────────────────────────────────
    await Promise.all([...videoEls.values()].map(vid =>
      new Promise<void>(resolve => {
        if (Math.abs(vid.currentTime - startTime) < 0.05) { resolve(); return; }
        vid.onseeked = () => resolve();
        vid.currentTime = startTime;
      })
    ));

    onProgress(0.05);

    // ── 3. Set up composite canvas ────────────────────────────────────────
    const canvas = document.createElement('canvas');
    canvas.width  = canvasLayout.outW;
    canvas.height = canvasLayout.outH;
    const ctx = canvas.getContext('2d', { alpha: false })!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ── 4. Set up MediaRecorder ───────────────────────────────────────────
    const mimeType = getBestMimeType();
    const ext      = mimeType.includes('mp4') ? 'mp4' : 'webm';
    const stream   = canvas.captureStream(CAPTURE_FPS);

    // Bitrate: six-camera at 1280×2486 needs more headroom
    const videoBitsPerSecond =
      layout === 'six'  ? 8_000_000 :
      layout === 'quad' ? 5_000_000 :
                          3_000_000;

    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond });
    const chunks: Blob[] = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

    // ── 5. Start recording and playback ───────────────────────────────────
    onPhase('encoding');
    recorder.start(200); // chunk every 200 ms

    for (const vid of videoEls.values()) {
      vid.playbackRate = PLAYBACK_RATE;
      await vid.play().catch(() => {});
    }

    // ── 6. Draw loop ──────────────────────────────────────────────────────
    const primaryCam = activeRects.find(r => r.cam === 'front')?.cam ?? activeRects[0].cam;
    const primaryVid = videoEls.get(primaryCam)!;

    await new Promise<void>(resolve => {
      let rafId: number;
      let lastTime = -1;

      const draw = () => {
        const elapsed = primaryVid.currentTime - startTime;

        // Done when we've captured the requested duration or video ended
        if (elapsed >= duration - 0.05 || primaryVid.ended) {
          cancelAnimationFrame(rafId);
          resolve();
          return;
        }

        // Only re-paint when primary video has a new frame
        if (primaryVid.currentTime !== lastTime) {
          lastTime = primaryVid.currentTime;

          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          for (const { cam, x, y, w, h } of activeRects) {
            const vid = videoEls.get(cam);
            if (vid && vid.readyState >= 2) {
              ctx.drawImage(vid, x, y, w, h);
            }
          }

          // Watermark: drawn last so it appears on top
          drawWatermark(ctx, canvas.width, canvas.height, elapsed, startTime, eventTimestamp ?? null);

          onProgress(0.05 + Math.min(elapsed / duration, 1) * 0.9);
        }

        rafId = requestAnimationFrame(draw);
      };

      rafId = requestAnimationFrame(draw);
    });

    // ── 7. Stop and package ───────────────────────────────────────────────
    for (const vid of videoEls.values()) vid.pause();
    recorder.stop();

    const blob = await new Promise<Blob>(resolve => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    });

    onProgress(1);
    onPhase('done');

    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    onComplete(blob, `tesvault-${layout}-${ts}.${ext}`);

  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  } finally {
    document.body.removeChild(container);
  }
}

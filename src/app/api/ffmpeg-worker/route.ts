/**
 * Same-origin proxy for the FFmpeg class worker script.
 *
 * Why needed:
 *   Browsers block `new Worker(cross-origin-url, { type: 'module' })`.
 *   FFmpeg.wasm internally creates a module worker from its esm.sh or CDN URL,
 *   which fails when the page is on localhost:3000.
 *
 * Solution:
 *   Serve a tiny JS file from the same origin that re-imports the real worker
 *   from CDN. Inside the imported module, import.meta.url stays as the CDN URL,
 *   so the worker's own relative imports (./classes.js etc.) resolve correctly.
 *
 * Usage in export.ts:
 *   Pass `classWorkerURL: window.location.origin + '/api/ffmpeg-worker'`
 *   to ffmpeg.load(). FFmpeg then does:
 *     new Worker('http://localhost:3000/api/ffmpeg-worker', { type: 'module' })
 *   which is same-origin → allowed.
 */

import { NextResponse } from 'next/server';

const WORKER_CDN = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/worker.js';

export async function GET() {
  const js = `import '${WORKER_CDN}';`;
  return new NextResponse(js, {
    headers: {
      'Content-Type': 'text/javascript',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

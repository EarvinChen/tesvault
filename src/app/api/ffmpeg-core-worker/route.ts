/**
 * Same-origin proxy for the FFmpeg core-mt (multi-threaded) pthreads worker.
 *
 * Why needed:
 *   @ffmpeg/core-mt uses Emscripten pthreads, which spawn additional Web Workers
 *   via `new Worker(workerURL)`. This call happens inside the FFmpeg class worker
 *   (already proxied via /api/ffmpeg-worker, running at localhost:3000 origin).
 *   Since the class worker's origin is localhost:3000, it can only create same-origin
 *   workers. We proxy the CDN worker script here to make it same-origin.
 *
 * Performance:
 *   With multi-threading (SharedArrayBuffer + multiple CPU cores), FFmpeg encodes
 *   2–8× faster than single-threaded @ffmpeg/core.
 */

import { NextResponse } from 'next/server';

const CORE_MT_WORKER_CDN =
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.6/dist/esm/ffmpeg-core.worker.js';

export async function GET() {
  const js = `import '${CORE_MT_WORKER_CDN}';`;
  return new NextResponse(js, {
    headers: {
      'Content-Type': 'text/javascript',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

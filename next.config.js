/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force clean build — bypass stale CDN cache
  generateBuildId: async () => `build-${Date.now()}`,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Required for SharedArrayBuffer (FFmpeg.wasm) and high-resolution timers
          // 'credentialless' enables SharedArrayBuffer (FFmpeg.wasm multi-thread)
          // while still allowing CDN resources without CORP headers.
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
          { key: "Cross-Origin-Opener-Policy",   value: "same-origin"  },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

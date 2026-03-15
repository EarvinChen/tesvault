'use client';

import React from 'react';
import { useI18n } from '@/lib/i18n';
import { useViewerStore } from '@/stores/viewer-store';

/**
 * DataDashboard — shows event metadata below the front camera.
 *
 * Tesla USB drives do NOT include machine-readable real-time telemetry
 * (speed, gear, FSD mode). That data is only rendered as a visual overlay
 * baked into the video frames and cannot be read programmatically.
 *
 * What IS available:
 *   - GPS coordinates from event.json (SavedClips / SentryClips only)
 *   - Event type / trigger reason
 *
 * Speed and gear fields are shown as placeholders for a future version
 * that could parse the video overlay via OCR or a dedicated Tesla API.
 */
export function DataDashboard() {
  const { t } = useI18n();
  const currentEvent = useViewerStore((s) => s.currentEvent);
  const location = currentEvent?.location;

  return (
    <div className="w-full h-12 bg-[#141414]/80 backdrop-blur-sm border-y border-[#2a2a2a] px-4 flex items-center gap-6 flex-shrink-0">

      {/* Gear — no data available from Tesla USB */}
      <div className="flex items-center gap-1.5" title={t('dashboard.gearTooltip')}>
        <svg className="w-4 h-4 text-[#555]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z" />
        </svg>
        <span className="text-xs font-semibold text-[#555]">--</span>
      </div>

      {/* Speed — no data available from Tesla USB */}
      <div className="flex items-center gap-1" title={t('dashboard.speedTooltip')}>
        <span className="text-lg font-bold text-[#555]">--</span>
        <span className="text-xs text-[#555]">km/h</span>
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-[#2a2a2a]" />

      {/* GPS — shown when event.json is available (SavedClips / SentryClips) */}
      {location ? (
        <div className="flex items-center gap-1.5" title={`GPS: ${location.lat.toFixed(6)}, ${location.lon.toFixed(6)}`}>
          <svg className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
          </svg>
          <span className="text-xs text-[#a0a0a0]">
            {location.street
              ? location.street
              : `${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}`}
          </span>
          {location.city && (
            <span className="text-xs text-[#555]">{location.city}</span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1.5" title={t('dashboard.gpsTooltip')}>
          <svg className="w-3.5 h-3.5 text-[#555] flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
          </svg>
          <span className="text-xs text-[#555]">{t('dashboard.noGps')}</span>
        </div>
      )}

      {/* Sentry trigger label (if applicable) */}
      {currentEvent?.sentryTrigger && currentEvent.sentryTrigger !== 'unknown' && (
        <>
          <div className="w-px h-5 bg-[#2a2a2a]" />
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
            </svg>
            <span className="text-xs text-yellow-500 capitalize">
              {{
                motion: t('dashboard.triggerMotion'),
                impact: t('dashboard.triggerImpact'),
                glass_break: t('dashboard.triggerGlass'),
                proximity: t('dashboard.triggerProximity'),
              }[currentEvent.sentryTrigger] ?? currentEvent.sentryTrigger}
            </span>
          </div>
        </>
      )}

      {/* Right side: data source note */}
      <div className="ml-auto flex items-center gap-1" title={t('dashboard.noTelemetryNote')}>
        <svg className="w-3.5 h-3.5 text-[#3a3a3a]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
        </svg>
        <span className="text-xs text-[#3a3a3a]">{t('dashboard.noTelemetry')}</span>
      </div>
    </div>
  );
}

'use client';

/**
 * ExportModal — UI for configuring and running a video export.
 *
 * Layout is auto-detected from the current viewer state:
 *   - focus mode  → single camera (the currently focused camera)
 *   - grid mode, 6 cameras → six layout
 *   - grid mode, 4 cameras → quad layout
 *
 * Encoding strategy (auto-selected at runtime):
 *   1. canvas.captureStream() + MediaRecorder (hardware encoder) — Chrome / Safari 14.1+
 *   2. FFmpeg.wasm (software libx264) — universal fallback
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { exportVideo, type ExportLayout, type ExportPhase } from '@/lib/export';
import { exportVideoCanvas, isCanvasExportSupported } from '@/lib/exportWebCodecs';
import { useViewerStore } from '@/stores/viewer-store';
import type { CameraPosition } from '@/types/tesla';

// ─── Camera display names ──────────────────────────────────────────────────────
const CAM_LABELS: Record<CameraPosition, string> = {
  front:       '前',
  back:        '後',
  left_front:  '左前',
  right_front: '右前',
  left_rear:   '左後',
  right_rear:  '右後',
};

const LAYOUT_LABELS: Record<ExportLayout, string> = {
  single: '單鏡頭',
  quad:   '四宮格',
  six:    '六宮格',
};

// Phase labels for the hardware (canvas) encoder path
const PHASE_LABELS_HW: Record<ExportPhase, string> = {
  loading_ffmpeg: '準備中…',
  preparing:      '讀取影片檔案…',
  encoding:       '硬體加速編碼中…',
  done:           '完成',
  error:          '發生錯誤',
};

// Phase labels for the FFmpeg.wasm fallback path
const PHASE_LABELS_SW: Record<ExportPhase, string> = {
  loading_ffmpeg: '載入 FFmpeg.wasm（首次約 30 MB）…',
  preparing:      '讀取影片檔案…',
  encoding:       '編碼中（H.264）…',
  done:           '完成',
  error:          '發生錯誤',
};

// ─── Props ─────────────────────────────────────────────────────────────────────
interface ExportModalProps {
  blobUrls: Partial<Record<CameraPosition, string>>;
  onClose:  () => void;
}

// ─── Helper ────────────────────────────────────────────────────────────────────
function fmtTime(s: number): string {
  const m  = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, '0')}`;
}

// ─── Component ─────────────────────────────────────────────────────────────────
export function ExportModal({ blobUrls, onClose }: ExportModalProps) {
  const duration     = useViewerStore((s) => s.duration);
  const currentTime  = useViewerStore((s) => s.currentTime);
  const cameraCount  = useViewerStore((s) => s.cameraCount);
  const layoutMode   = useViewerStore((s) => s.layoutMode);
  const focusedCamera = useViewerStore((s) => s.focusedCamera);
  const currentEvent = useViewerStore((s) => s.currentEvent);

  // ── Auto-detect export layout from current viewer state ──────────────────
  const autoLayout: ExportLayout = useMemo(() => {
    if (layoutMode === 'focus') return 'single';
    return cameraCount === 6 ? 'six' : 'quad';
  }, [layoutMode, cameraCount]);

  const autoSingleCam: CameraPosition = focusedCamera ?? 'front';

  // ── Capability detection ─────────────────────────────────────────────────
  const useHardwareEncoder = useMemo(() => isCanvasExportSupported(), []);
  const PHASE_LABELS = useHardwareEncoder ? PHASE_LABELS_HW : PHASE_LABELS_SW;

  // ── Form state ──────────────────────────────────────────────────────────────
  const [startTime, setStartTime] = useState(0);
  // Use lazy initializer so we capture duration at mount (duration is already
  // loaded when the modal opens; this avoids a setState-in-effect lint error).
  const [endTime,   setEndTime]   = useState(() => duration > 0 ? duration : 60);

  // ── Export state ─────────────────────────────────────────────────────────────
  const [phase,       setPhase]       = useState<ExportPhase | null>(null);
  const [progress,    setProgress]    = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [filename,    setFilename]    = useState('tesvault.mp4');
  const [errorMsg,    setErrorMsg]    = useState('');

  const availableCams = (Object.keys(blobUrls) as CameraPosition[]).filter((k) => !!blobUrls[k]);
  const isExporting   = phase !== null && phase !== 'done' && phase !== 'error';
  const isDone        = phase === 'done';
  const isError       = phase === 'error';

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    if (isExporting) return;
    setPhase(useHardwareEncoder ? 'preparing' : 'loading_ffmpeg');
    setProgress(0);
    setErrorMsg('');
    setDownloadUrl(null);

    const exportOptions = {
      layout:           autoLayout,
      singleCamera:     autoSingleCam,
      blobUrls,
      startTime,
      endTime,
      eventTimestamp:   currentEvent?.timestamp,
      onPhase:    (p: ExportPhase) => setPhase(p),
      onProgress: (f: number) => setProgress(f),
      onComplete: (blob: Blob, fname: string) => {
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);
        setFilename(fname);
      },
      onError: (err: Error) => {
        setErrorMsg(err.message);
        setPhase('error');
      },
    };

    if (useHardwareEncoder) {
      await exportVideoCanvas(exportOptions);
    } else {
      await exportVideo(exportOptions);
    }
  }, [autoLayout, autoSingleCam, blobUrls, startTime, endTime, isExporting, useHardwareEncoder]);

  const handleReset = useCallback(() => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setDownloadUrl(null);
    setPhase(null);
    setProgress(0);
    setErrorMsg('');
  }, [downloadUrl]);

  const handleDownload = useCallback(() => {
    if (!downloadUrl) return;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    a.click();
  }, [downloadUrl, filename]);

  useEffect(() => () => { if (downloadUrl) URL.revokeObjectURL(downloadUrl); }, [downloadUrl]);

  // ── Clip info ─────────────────────────────────────────────────────────────────
  const clipLen = endTime - startTime;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !isExporting) onClose(); }}
    >
      <div className="relative w-full max-w-md mx-4 rounded-2xl bg-[#141414] border border-[#2a2a2a] shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <h2 className="text-[#e5e5e5] font-semibold text-base">匯出影片</h2>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="text-[#666] hover:text-[#e5e5e5] disabled:opacity-30 transition-colors"
            aria-label="關閉"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">

          {/* Event info */}
          {currentEvent && (
            <div className="text-xs text-[#666] bg-[#1a1a1a] rounded-lg px-3 py-2">
              {currentEvent.id}&nbsp;·&nbsp;總長 {fmtTime(duration)}
            </div>
          )}

          {/* Auto-detected layout info */}
          <div className="flex items-center gap-2 bg-[#1a1a1a] rounded-lg px-3 py-2.5">
            <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 10l4.553-2.069A1 1 0 0121 8.845v6.31a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
            <div className="text-xs text-[#aaa]">
              <span className="text-[#e5e5e5] font-medium">匯出模式：{LAYOUT_LABELS[autoLayout]}</span>
              {autoLayout === 'single' && (
                <span className="ml-1 text-blue-400">（{CAM_LABELS[autoSingleCam]}鏡頭）</span>
              )}
            </div>
          </div>

          {/* Time range */}
          <div>
            <label className="block text-xs text-[#888] mb-2">
              時間範圍
              <span className="ml-1 text-[#555]">
                {fmtTime(startTime)} → {fmtTime(endTime)}（{fmtTime(clipLen)}）
              </span>
            </label>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#666] w-8 shrink-0">開始</span>
                <input type="range" min={0} max={duration} step={0.5} value={startTime}
                  disabled={isExporting}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setStartTime(v);
                    if (v >= endTime) setEndTime(Math.min(v + 1, duration));
                  }}
                  className="flex-1 accent-[#1d6adf]"
                />
                <span className="text-xs text-[#aaa] w-10 text-right shrink-0">{fmtTime(startTime)}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#666] w-8 shrink-0">結束</span>
                <input type="range" min={0} max={duration} step={0.5} value={endTime}
                  disabled={isExporting}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setEndTime(v);
                    if (v <= startTime) setStartTime(Math.max(v - 1, 0));
                  }}
                  className="flex-1 accent-[#1d6adf]"
                />
                <span className="text-xs text-[#aaa] w-10 text-right shrink-0">{fmtTime(endTime)}</span>
              </div>
              <div className="flex gap-2 mt-1">
                <button disabled={isExporting}
                  onClick={() => { setStartTime(0); setEndTime(duration); }}
                  className="text-xs text-[#666] hover:text-[#aaa] disabled:opacity-40">
                  全片段
                </button>
                {currentTime > 0 && currentTime < duration && (
                  <>
                    <span className="text-[#333]">·</span>
                    <button disabled={isExporting}
                      onClick={() => {
                        setStartTime(Math.max(0, currentTime - 15));
                        setEndTime(Math.min(duration, currentTime + 15));
                      }}
                      className="text-xs text-[#666] hover:text-[#aaa] disabled:opacity-40">
                      目前位置前後 15 秒
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Notice */}
          {useHardwareEncoder ? (
            <p className="text-xs text-[#555] leading-relaxed">
              ⚡ 使用硬體加速編碼。輸出格式：MP4（H.264）或 WebM，視瀏覽器而定。
            </p>
          ) : (
            <p className="text-xs text-[#555] leading-relaxed">
              使用 FFmpeg.wasm 編碼。首次使用需下載約 30 MB（下載後快取）。
              建議使用 Chrome 以獲得硬體加速。
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 space-y-3">

          {/* Progress */}
          {isExporting && (
            <div className="space-y-1.5">
              <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                <div className="h-full bg-[#1d6adf] transition-all duration-300 ease-out"
                  style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <p className="text-xs text-[#555]">
                {phase ? PHASE_LABELS[phase] : ''}&nbsp;{Math.round(progress * 100)}%
              </p>
            </div>
          )}

          {/* Error */}
          {isError && (
            <div className="text-xs text-red-400 bg-red-900/20 rounded-lg px-3 py-2 break-words">
              {errorMsg || '匯出失敗，請重試'}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            {isDone ? (
              <>
                <button onClick={handleDownload}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#1d6adf] hover:bg-[#1558c0] text-white text-sm font-medium transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  下載 MP4
                </button>
                <button onClick={handleReset}
                  className="px-4 py-2.5 rounded-xl border border-[#2a2a2a] text-[#aaa] text-sm hover:border-[#444] transition-colors">
                  重新設定
                </button>
              </>
            ) : isExporting ? (
              <div className="flex-1 flex items-center justify-center py-2.5 text-[#555] text-sm">
                匯出中，請稍候…
              </div>
            ) : (
              <>
                <button
                  onClick={handleExport}
                  disabled={clipLen <= 0 || availableCams.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#1d6adf] hover:bg-[#1558c0] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  開始匯出
                </button>
                <button onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-[#2a2a2a] text-[#aaa] text-sm hover:border-[#444] transition-colors">
                  取消
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

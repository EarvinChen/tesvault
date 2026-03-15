// Lightweight i18n module — Zustand-based, no heavy deps
// Supports zh-TW (Traditional Chinese) and en (English)

import { create } from 'zustand';

export type Locale = 'zh' | 'en';

interface I18nStore {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
}

// ---------- dictionaries ----------

const zh: Record<string, string> = {
  // App metadata
  'app.title': 'TesVault — Tesla 行車記錄器 Web 播放器',
  'app.description': '免安裝、支援最新六鏡頭 (HW4) 架構的 Tesla 行車記錄器 Web 播放器',

  // Landing page
  'landing.headline': 'Tesla 行車記錄器 Web 播放器',
  'landing.subheadline': '免安裝・六鏡頭同步・瀏覽器直接開',
  'landing.iosTitle': '📱 iOS 操作說明',
  'landing.iosStep1': '將 Tesla USB 隨身碟透過轉接頭接上 iPhone，打開',
  'landing.iosStep1Files': '檔案 App',
  'landing.iosStep1Path': 'TeslaCam → RecentClips（或事件資料夾）',
  'landing.iosStep2': '長按選取全部 mp4 影片後，點下方的按鈕選擇即可。',
  'landing.loading': '讀取中，請稍候…',
  'landing.iosSelectBtn': '點擊選擇影片檔案',
  'landing.iosSelectHint': '從「檔案 App」選取 TeslaCam mp4 影片',
  'landing.dropHint': '拖放 TeslaCam 資料夾到此處',
  'landing.dropClickHint': '或點擊此處選擇資料夾',
  'landing.btnLoading': '讀取中…',
  'landing.btnIos': '選擇 TeslaCam 影片檔案',
  'landing.btnDesktop': '選擇 TeslaCam 資料夾',
  'landing.feat1Title': '六鏡頭同步',
  'landing.feat1Desc': '支援最新 HW4 六鏡頭架構同步播放',
  'landing.feat2Title': '免安裝',
  'landing.feat2Desc': '瀏覽器直接開，無需下載軟體',
  'landing.feat3Title': '深色主題',
  'landing.feat3Desc': '專為夜間駕駛影片優化',
  'landing.feat4Title': '鍵盤快捷鍵',
  'landing.feat4Desc': '快速控制播放和調整設定',
  'landing.kbTitle': '快速鍵提示',
  'landing.kbPlayPause': '播放/暫停',
  'landing.kbSeek': '快進/快退 5 秒',
  'landing.kbVolume': '音量',
  'landing.kbFullscreen': '全螢幕',
  'landing.kbSpeed': '速度',
  'landing.kbGrid': '返回網格',

  // Header
  'header.selectVideos': '選擇影片',
  'header.selectFolder': '選擇資料夾',

  // Sidebar / Event list
  'eventList.all': '全部',
  'eventList.recent': '最近',
  'eventList.saved': '保存',
  'eventList.sentry': '哨兵',
  'eventList.empty': '沒有事件',

  // Event card
  'eventCard.recent': '最近',
  'eventCard.saved': '保存',
  'eventCard.sentry': '哨兵',
  'eventCard.cameras': '鏡頭',
  'eventCard.complete': '完整',
  'eventCard.incomplete': '不完整',

  // Camera labels
  'cam.front': '前',
  'cam.back': '後',
  'cam.leftFront': '左前',
  'cam.rightFront': '右前',
  'cam.leftRear': '左後',
  'cam.rightRear': '右後',

  // Video grid
  'videoGrid.selectEvent': '請選擇一個事件',
  'videoGrid.backOverview': '返回總覽 (Esc)',
  'videoGrid.back': '返回',
  'videoGrid.shrink': '縮小',
  'videoGrid.enlarge': '放大',

  // Viewer page
  'viewer.selectEvent': '請選擇一個事件',
  'viewer.openList': '開啟事件列表',
  'viewer.hint': '在左側邊欄選擇事件開始播放',

  // Playback controls
  'controls.rewind': '後退 10 秒',
  'controls.pause': '暫停 (空白鍵)',
  'controls.play': '播放 (空白鍵)',
  'controls.forward': '前進 10 秒',
  'controls.prevClip': '上一片段',
  'controls.nextClip': '下一片段',
  'controls.speed': '播放速度',
  'controls.exportVideo': '匯出影片',
  'controls.export': '匯出',
  'controls.fullscreen': '全螢幕 (F)',

  // Data dashboard
  'dashboard.gearTooltip': '排檔位置（Tesla USB 無遙測數據）',
  'dashboard.speedTooltip': '車速（Tesla USB 無遙測數據）',
  'dashboard.gpsTooltip': 'GPS（僅 SavedClips / SentryClips 的 event.json 包含座標）',
  'dashboard.noGps': '無 GPS',
  'dashboard.triggerMotion': '移動偵測',
  'dashboard.triggerImpact': '碰撞',
  'dashboard.triggerGlass': '玻璃破碎',
  'dashboard.triggerProximity': '靠近',
  'dashboard.noTelemetryNote': 'Tesla USB 不含即時遙測數據（速度/排檔）。數據僅顯示於影片畫面覆蓋層中。',
  'dashboard.noTelemetry': '無遙測',

  // Export modal
  'export.title': '匯出影片',
  'export.close': '關閉',
  'export.totalLength': '總長',
  'export.segments': '片段',
  'export.layoutLabel': '匯出模式',
  'export.layoutSingle': '單鏡頭',
  'export.layoutQuad': '四宮格',
  'export.layoutHex': '六宮格',
  'export.camera': '鏡頭',
  'export.timeRange': '時間範圍',
  'export.start': '開始',
  'export.end': '結束',
  'export.allSegments': '全片段（最多 3 分鐘）',
  'export.around15s': '目前位置前後 15 秒',
  'export.iosWarning': '📱 iPhone/iPad 的硬體解碼器數量有限，多鏡頭同時播放可能導致部分畫面凍結。',
  'export.iosRecommend': '建議切換到',
  'export.iosSingleMode': '單鏡頭模式',
  'export.iosBestResult': '以獲得最佳效果。',
  'export.longWarning': '⚠️ 匯出超過 3 分鐘，畫面渲染時間較長，請耐心等候。',
  'export.webcodecNote': '⚡ 使用硬體加速編碼。輸出格式：MP4（H.264）或 WebM，視瀏覽器而定。',
  'export.ffmpegNote': '使用 FFmpeg.wasm 編碼。首次使用需下載約 30 MB（下載後快取）。',
  'export.chromeHint': '建議使用 Chrome 以獲得硬體加速。',
  'export.failed': '匯出失敗，請重試',
  'export.download': '下載 MP4',
  'export.reset': '重新設定',
  'export.exporting': '匯出中，請稍候…',
  'export.startExport': '開始匯出',
  'export.cancel': '取消',

  // Export phases (WebCodecs)
  'phase.wc.prepare': '準備中…',
  'phase.wc.decode': '讀取影片檔案…',
  'phase.wc.encode': '硬體加速編碼中…',
  'phase.wc.done': '完成',
  'phase.wc.error': '發生錯誤',

  // Export phases (FFmpeg)
  'phase.ff.load': '載入 FFmpeg.wasm（首次約 30 MB）…',
  'phase.ff.read': '讀取影片檔案…',
  'phase.ff.encode': '編碼中（H.264）…',
  'phase.ff.done': '完成',
  'phase.ff.error': '發生錯誤',
};

const en: Record<string, string> = {
  // App metadata
  'app.title': 'TesVault — Tesla Dashcam Web Player',
  'app.description': 'Install-free Tesla dashcam web player supporting the latest 6-camera (HW4) architecture',

  // Landing page
  'landing.headline': 'Tesla Dashcam Web Player',
  'landing.subheadline': 'Install-free • 6-Camera Sync • Browser-based',
  'landing.iosTitle': '📱 iOS Instructions',
  'landing.iosStep1': 'Connect Tesla USB drive to iPhone via adapter, open ',
  'landing.iosStep1Files': 'Files App',
  'landing.iosStep1Path': 'TeslaCam → RecentClips (or event folder)',
  'landing.iosStep2': 'Long-press to select all MP4 videos, then tap the button below.',
  'landing.loading': 'Loading, please wait…',
  'landing.iosSelectBtn': 'Select Video Files',
  'landing.iosSelectHint': 'Choose TeslaCam MP4 videos from the Files App',
  'landing.dropHint': 'Drag & drop TeslaCam folder here',
  'landing.dropClickHint': 'or click to select folder',
  'landing.btnLoading': 'Loading…',
  'landing.btnIos': 'Select TeslaCam Video Files',
  'landing.btnDesktop': 'Select TeslaCam Folder',
  'landing.feat1Title': '6-Camera Sync',
  'landing.feat1Desc': 'Supports latest HW4 six-camera synchronized playback',
  'landing.feat2Title': 'Install-free',
  'landing.feat2Desc': 'Runs directly in your browser, no downloads',
  'landing.feat3Title': 'Dark Theme',
  'landing.feat3Desc': 'Optimized for night-time driving footage',
  'landing.feat4Title': 'Keyboard Shortcuts',
  'landing.feat4Desc': 'Fast playback control and settings',
  'landing.kbTitle': 'Keyboard Shortcuts',
  'landing.kbPlayPause': 'Play / Pause',
  'landing.kbSeek': 'Forward / Rewind 5 sec',
  'landing.kbVolume': 'Volume',
  'landing.kbFullscreen': 'Fullscreen',
  'landing.kbSpeed': 'Speed',
  'landing.kbGrid': 'Back to grid',

  // Header
  'header.selectVideos': 'Select Videos',
  'header.selectFolder': 'Select Folder',

  // Sidebar / Event list
  'eventList.all': 'All',
  'eventList.recent': 'Recent',
  'eventList.saved': 'Saved',
  'eventList.sentry': 'Sentry',
  'eventList.empty': 'No events',

  // Event card
  'eventCard.recent': 'Recent',
  'eventCard.saved': 'Saved',
  'eventCard.sentry': 'Sentry',
  'eventCard.cameras': 'cameras',
  'eventCard.complete': 'Complete',
  'eventCard.incomplete': 'Incomplete',

  // Camera labels
  'cam.front': 'Front',
  'cam.back': 'Back',
  'cam.leftFront': 'Left Front',
  'cam.rightFront': 'Right Front',
  'cam.leftRear': 'Left Rear',
  'cam.rightRear': 'Right Rear',

  // Video grid
  'videoGrid.selectEvent': 'Please select an event',
  'videoGrid.backOverview': 'Back to overview (Esc)',
  'videoGrid.back': 'Back',
  'videoGrid.shrink': 'Shrink',
  'videoGrid.enlarge': 'Enlarge',

  // Viewer page
  'viewer.selectEvent': 'Please select an event',
  'viewer.openList': 'Open event list',
  'viewer.hint': 'Select an event in the sidebar to start playback',

  // Playback controls
  'controls.rewind': 'Rewind 10s',
  'controls.pause': 'Pause (Space)',
  'controls.play': 'Play (Space)',
  'controls.forward': 'Forward 10s',
  'controls.prevClip': 'Previous clip',
  'controls.nextClip': 'Next clip',
  'controls.speed': 'Playback speed',
  'controls.exportVideo': 'Export video',
  'controls.export': 'Export',
  'controls.fullscreen': 'Fullscreen (F)',

  // Data dashboard
  'dashboard.gearTooltip': 'Gear (Tesla USB has no telemetry data)',
  'dashboard.speedTooltip': 'Speed (Tesla USB has no telemetry data)',
  'dashboard.gpsTooltip': 'GPS (only SavedClips / SentryClips event.json contain coordinates)',
  'dashboard.noGps': 'No GPS',
  'dashboard.triggerMotion': 'Motion',
  'dashboard.triggerImpact': 'Impact',
  'dashboard.triggerGlass': 'Glass Break',
  'dashboard.triggerProximity': 'Proximity',
  'dashboard.noTelemetryNote': 'Tesla USB does not contain real-time telemetry (speed/gear). Data is only visible in the video frame overlay.',
  'dashboard.noTelemetry': 'No telemetry',

  // Export modal
  'export.title': 'Export Video',
  'export.close': 'Close',
  'export.totalLength': 'Total',
  'export.segments': 'segments',
  'export.layoutLabel': 'Export mode',
  'export.layoutSingle': 'Single',
  'export.layoutQuad': 'Quad',
  'export.layoutHex': 'Hex',
  'export.camera': 'camera',
  'export.timeRange': 'Time Range',
  'export.start': 'Start',
  'export.end': 'End',
  'export.allSegments': 'All segments (max 3 min)',
  'export.around15s': '15 sec around current position',
  'export.iosWarning': '📱 iPhone/iPad has limited hardware decoders. Multi-camera export may produce frozen frames.',
  'export.iosRecommend': 'Switch to',
  'export.iosSingleMode': 'single camera mode',
  'export.iosBestResult': 'for best results.',
  'export.longWarning': '⚠️ Export exceeds 3 minutes — rendering will take longer.',
  'export.webcodecNote': '⚡ Hardware-accelerated encoding. Output: MP4 (H.264) or WebM depending on browser.',
  'export.ffmpegNote': 'FFmpeg.wasm encoding. First use downloads ~30 MB (cached afterwards).',
  'export.chromeHint': 'Chrome recommended for hardware acceleration.',
  'export.failed': 'Export failed. Please try again.',
  'export.download': 'Download MP4',
  'export.reset': 'Reset',
  'export.exporting': 'Exporting, please wait…',
  'export.startExport': 'Start Export',
  'export.cancel': 'Cancel',

  // Export phases (WebCodecs)
  'phase.wc.prepare': 'Preparing…',
  'phase.wc.decode': 'Reading video files…',
  'phase.wc.encode': 'Hardware-accelerated encoding…',
  'phase.wc.done': 'Done',
  'phase.wc.error': 'Error',

  // Export phases (FFmpeg)
  'phase.ff.load': 'Loading FFmpeg.wasm (~30 MB first time)…',
  'phase.ff.read': 'Reading video files…',
  'phase.ff.encode': 'Encoding (H.264)…',
  'phase.ff.done': 'Done',
  'phase.ff.error': 'Error',
};

const dictionaries: Record<Locale, Record<string, string>> = { zh, en };

// Detect browser language, default to zh
function detectLocale(): Locale {
  if (typeof window === 'undefined') return 'zh';
  const stored = localStorage.getItem('tesvault-locale') as Locale | null;
  if (stored && dictionaries[stored]) return stored;
  const lang = navigator.language.toLowerCase();
  return lang.startsWith('zh') ? 'zh' : 'en';
}

export const useI18n = create<I18nStore>((set, get) => ({
  locale: 'zh', // SSR-safe default; hydrated in provider
  setLocale: (l: Locale) => {
    if (typeof window !== 'undefined') localStorage.setItem('tesvault-locale', l);
    set({ locale: l });
  },
  t: (key: string) => {
    const dict = dictionaries[get().locale];
    return dict[key] ?? key;
  },
}));

// Call once on client mount to sync with browser language
export function hydrateLocale() {
  const locale = detectLocale();
  useI18n.getState().setLocale(locale);
}

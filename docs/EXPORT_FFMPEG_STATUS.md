# 影片匯出功能 — 技術記錄

> 最後更新：2026-03-12　狀態：✅ **完成**

---

## 最終架構

匯出功能採用**雙路線自動選擇**策略，在 `ExportModal.tsx` 啟動時透過
`isCanvasExportSupported()` 偵測瀏覽器能力，自動選擇最快的可用引擎：

```
瀏覽器支援 canvas.captureStream() + MediaRecorder？
  ├─ YES → 🚀 硬體加速路線（src/lib/exportWebCodecs.ts）
  └─ NO  → 🔧 FFmpeg.wasm 備援路線（src/lib/export.ts）
```

### 路線 1：硬體加速（主要）

- **技術**：`HTMLCanvasElement.captureStream(30fps)` + `MediaRecorder`
- **原理**：6 個 `<video>` 元素以 1× 播放速率播放，`requestAnimationFrame` 迴圈將影格繪製到 canvas，MediaRecorder 錄製 canvas stream
- **輸出格式**：`video/mp4; codecs=avc1.42E01E`（H.264），若瀏覽器不支援則退回 WebM
- **速度**：~1× realtime（42 秒影片約 43 秒完成），仍比 FFmpeg.wasm 快 20× 以上
- **相容性**：Chrome 74+、Safari 14.1+、Firefox 101+
- **無音訊**：Tesla 行車記錄器不錄音，省略 audio track
- **關鍵檔案**：`src/lib/exportWebCodecs.ts`
- **重要**：video 元素容器必須保持在 viewport 內（`opacity:0.001`），否則 Chrome 會把 off-screen media 限速到 ~0.2×，導致輸出時長膨脹 5 倍

### 路線 2：FFmpeg.wasm 備援

- **技術**：`@ffmpeg/ffmpeg@0.12.10` + `@ffmpeg/core@0.12.6`（單執行緒，無 SIMD）
- **速度**：~0.1× realtime（速度慢，但在不支援 canvas export 的瀏覽器是唯一選項）
- **Preset**：`ultrafast`（較 `fast` 快 3-5×）
- **關鍵檔案**：`src/lib/export.ts`

---

## 解決過程記錄

開發過程中遭遇多個技術障礙，按解決順序記錄如下：

### 問題 1：`ffmpeg.load()` 靜默掛起在 0%

**根本原因**：主模組使用 `esm.sh` 建置，Worker 使用 `jsdelivr` npm dist 建置，
兩者的內部 message 協定格式不相容，導致握手永遠不完成。

**解法**：統一改用 `cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js`

### 問題 2：跨域 Worker 禁止

**根本原因**：瀏覽器禁止 `new Worker(cross-origin-url, { type: 'module' })`

**解法**：建立 Next.js API route `/api/ffmpeg-worker`，回傳 `import 'CDN_URL';`
Worker 從 localhost 載入，但模組的 `import.meta.url` 仍指向 CDN，相對路徑正確解析。

### 問題 3：`@ffmpeg/core-mt` 32 Worker 死鎖

**根本原因**：`@ffmpeg/core-mt@0.12.6` 的 `PTHREAD_POOL_SIZE` 編譯時硬編碼為 32，
32 個 Worker 同時預建導致記憶體耗盡，瀏覽器 tab 崩潰。

**解法**：改回單執行緒 `@ffmpeg/core`，移除 `workerURL` 參數。
多執行緒路線放棄，改以 WebCodecs 硬體加速解決速度問題。

### 問題 4：單執行緒編碼速度無法接受

**根本原因**：`@ffmpeg/core` 是無 SIMD、無多執行緒的 Emscripten 建置，
1280×1440 六宮格影片編碼需要 20+ 分鐘。

**解法**：實作 WebCodecs 路線（`canvas.captureStream()` + `MediaRecorder`），
利用瀏覽器的硬體視訊編碼器（VideoToolbox / Media Foundation / VA-API），
不需要任何 WASM，速度提升約 30×。

---

## CDN 設定（export.ts）

```typescript
// 主模組與 Worker 使用相同 CDN build，避免協定不相容
const FFMPEG_CDN = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js';
const CORE_CDN   = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js';
const WASM_CDN   = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm';

// Proxy routes（解決跨域 Worker 限制）
// /api/ffmpeg-worker      → import '@ffmpeg/ffmpeg@0.12.10 dist/esm/worker.js'
// /api/ffmpeg-core-worker → import '@ffmpeg/core-mt@0.12.6 dist/esm/ffmpeg-core.worker.js'
//                           （目前未使用，保留供日後 core-mt 測試用）
```

## COOP/COEP 設定（next.config.js）

```javascript
{ key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
{ key: 'Cross-Origin-Opener-Policy',   value: 'same-origin' },
```

---

## 實測結果

### F102 初版（2026-03-11）

| 項目 | 結果 |
|------|------|
| 測試片段 | 保存事件，2026-03-10，42 秒，6 鏡頭 |
| 硬體加速偵測 | ✅ `isCanvasExportSupported()` = true |
| 編碼格式 | `video/mp4; codecs=avc1.42E01E`（H.264）|
| 完成時間 | ~15 秒 |
| 下載 | ✅ 正常 |
| Console 錯誤 | 無 |

---

## 優化修正（2026-03-12）

本次修正 5 項已知問題，變更涉及以下檔案：
`viewer-store.ts`、`PlaybackControls.tsx`、`VideoGrid.tsx`、`ExportModal.tsx`、`exportWebCodecs.ts`

### 驗證方式說明

`showDirectoryPicker()` 需要真實使用者手勢，自動化測試工具（CDP）觸發的點擊事件無法通過瀏覽器的 transient activation 要求，因此完整 E2E 測試需要使用者手動選擇資料夾。

| 驗證類型 | 方法 | 狀態 |
|----------|------|------|
| TypeScript 型別檢查 | `npx tsc --noEmit` | ✅ 0 errors |
| ESLint 靜態分析 | `npm run lint` | ✅ 本次修改未新增任何 error |
| 瀏覽器 E2E | 自動化點擊 + 資料夾載入 | ⚠️ 需使用者手動選擇資料夾 |

> 原有 17 個 ESLint errors 為修改前就存在的舊問題（VideoGrid refs 誤報、page.tsx effect、useFileAccess any 型別），本次修改未引入新的 error。

### 修正項目靜態驗證

#### Fix 1：匯出按鈕位置
- **改法**：從 `VideoGrid` 影片疊層移到 `PlaybackControls` 工具列右側
- **靜態確認**：`PlaybackControls.tsx` 新增藍色按鈕元素，呼叫 `openExportModal()`；`VideoGrid.tsx` 已移除舊有疊層按鈕 ✅

#### Fix 2：自動偵測佈局
- **改法**：`ExportModal.tsx` 移除手動選擇 UI，改從 store 讀取 `layoutMode`、`cameraCount`、`focusedCamera`
- **靜態確認**：`autoLayout` useMemo 邏輯正確；`layoutMode === 'focus'` → single，`cameraCount === 6` → six，其餘 → quad ✅

#### Fix 3：輸出速度 4× 過快（Bug）
- **根本原因**：`exportWebCodecs.ts` 舊版 `PLAYBACK_RATE = 4`，MediaRecorder 以實際時鐘錄製，影片播 4× → 輸出變 4×
- **改法**：`PLAYBACK_RATE = 1`
- **靜態確認**：程式碼已更新 ✅；預期效果：42 秒片段編碼約需 42 秒（仍比 FFmpeg.wasm 快 20×）

#### Fix 4：浮水印顯示實際拍攝時間
- **改法**：新增 `drawWatermark()` 函式，每幀在右下角繪製 `DashView YYYY-MM-DD HH:MM:SS`（真實拍攝時間），而非只顯示相對秒數 `MM:SS`
- **時間計算**：`eventTimestamp`（資料夾名稱解析出的事件起始時間）+ `startTime + elapsed`（秒）→ 格式化為本地時間
- **靜態確認**：`ExportOptions.eventTimestamp?: Date` 介面已擴充；`ExportModal` 傳入 `currentEvent?.timestamp`；`drawWatermark()` 函式存在且在 rAF 迴圈中正確呼叫 ✅

#### Fix 5：六宮格比例失真
- **根本原因**：舊版每列高度硬編碼 360px（AR = 3.56:1），與實際 HW4 攝影機 724:469 ≈ 1.543:1 相差甚遠
- **改法**：依真實比例計算 `FULL_H = 829px`、`HALF_H = 414px`，六宮格輸出尺寸 `1280 × 2486`
- **靜態確認**：常數計算正確（`Math.round(1280 × 469/724) = 829`）✅

### E2E 驗證結果（2026-03-12）

使用者載入真實 TeslaCam 資料夾（90 事件：2 recent / 7 saved / 81 sentry），
以「保存」事件（2026-03-10 19:06:43，42 秒，6 鏡頭）進行完整匯出測試。

- [x] 工具列藍色「匯出」按鈕顯示在正確位置（toolbar 右側）
- [x] 匯出視窗顯示自動偵測的佈局（單鏡頭 / 六宮格，無手動選擇）
- [x] 輸出影片時長正確：**42.94 秒**（預期 ~42 秒）
- [x] 影片右下角浮水印：**`DashView  2026-03-10  19:06:48`**（真實拍攝時間）
- [x] 輸出尺寸：**1280 × 828**（預期 1280 × 829，差 1px 因 H.264 偶數限制，正常）
- [x] 平均幀率：~30fps

#### 額外修正：Chrome off-screen 媒體節流（2026-03-12）

**問題**：第一次完整 E2E 測試輸出時長為 222 秒（預期 42 秒），差了 5.3 倍。

**根本原因**：video 元素容器使用 `top:-9999px; left:-9999px`，
Chrome 將超出 viewport 的 media element 判斷為「不可見媒體」並自動限速至約 0.19×。
MediaRecorder 以真實時鐘錄製，因此輸出時長 = 實際播放牆鐘時間（222 秒），非影片內容長度（42 秒）。

**修法**：將容器改為 `position:fixed; top:0; left:0; opacity:0.001; z-index:-9999;`，
使 video 元素留在 viewport 範圍內，Chrome 不再限速，輸出時長恢復正常。

**對比**：

| 版本 | 容器位置 | 輸出時長 | 說明 |
|------|----------|----------|------|
| 修前 | `top:-9999px`（off-screen）| 222 秒 | Chrome 節流到 0.19× |
| 修後 | `top:0; opacity:0.001`（on-screen）| **42.94 秒** | 正常 ✅ |

# DashView — MVP 開發進度追蹤

> 記錄每個步驟的完成狀態與實際和規格的差異。
> 狀態符號：✅ 完成 · ⚠️ 完成但有差異 · ❌ 未完成

---

## Step 0: 專案初始化 ✅

```
npx create-next-app@latest . --typescript --tailwind --app --src-dir --use-npm
npm install zustand
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

**實際狀態：** 完成。使用 Next.js 16 + React 19 + Tailwind CSS v4。

---

## Step 1: 核心類型定義與資料夾解析器 ⚠️

**實際狀態：** 完成，但實作與規格有重大差異（基於真實 USB 資料驗證後修正）。

### 實際與規格差異

**規格假設的資料夾結構（舊版，錯誤的）：**
```
RecentClips/YYYY-MM-DD_HH-MM-SS/front.mp4   ← 巢狀，錯的
```

**實際 HW4 USB 結構（已驗證於 /Users/cheni/Desktop/TeslaCam）：**
```
RecentClips/YYYY-MM-DD_HH-MM-SS-front.mp4                          ← 扁平
SavedClips/YYYY-MM-DD_HH-MM-SS/YYYY-MM-DD_HH-MM-SS-front.mp4      ← 巢狀
SentryClips/YYYY-MM-DD_HH-MM-SS/YYYY-MM-DD_HH-MM-SS-front.mp4     ← 巢狀
```

**相機後綴差異：**

| 規格（錯誤） | 實際 USB 後綴（HW4） | 內部 CameraPosition |
|---|---|---|
| `left_rear.mp4` | `left_pillar.mp4` | `left_rear` |
| `right_rear.mp4` | `right_pillar.mp4` | `right_rear` |

**新增功能（規格未包含）：**
- `ClipGroup` interface：每個事件可含多個 1 分鐘片段
- `clips: ClipGroup[]` + `activeClipIndex` 欄位（預設指向最後一段）
- RecentClips 自動 session 分組：≤5 分鐘間隔的片段合併為同一駕駛 session

### 已完成的檔案

- `src/types/tesla.ts` — 完整類型定義，含 `ClipGroup`、`TeslaCamEvent`、`ParseResult`
- `src/lib/tesla/camera-config.ts` — `CAMERA_SUFFIX_TO_POSITION`、`detectCameraConfig`、`getCameraLabel`
- `src/lib/tesla/parser.ts` — 完整重寫，支援 HW4 扁平/巢狀結構 + session 分組
- `tests/unit/parser.test.ts` — TC-U001~U010, U018~U024（已更新為實際 HW4 格式）

**注意：** Vitest 在此 ARM64 VM 環境無法執行（缺少 `@rollup/rollup-linux-arm64-gnu`），
但所有測試邏輯已通過 `npx tsc --noEmit` TypeScript 型別檢查。

---

## Step 2: 影片同步引擎 ⚠️

**實際狀態：** 骨架存在，但主要同步邏輯整合進了 `VideoGrid.tsx`（未獨立為 SyncEngine class）。

### 實際實作

- 以 `front` 鏡頭的 React `onTimeUpdate` 事件作為 master clock
- `isPlaying` 狀態變化 → `useEffect` 對所有 video element 呼叫 `.play()` / `.pause()`
- `playbackRate`、`volume`、`isMuted` 同理各有對應 `useEffect`
- seek 操作用 0.5 秒閾值避免與 `timeupdate` 衝突
- focus 模式切換後，以 `requestAnimationFrame` 輪詢直到所有 video element readyState ≥ 1，再統一 seek 回正確位置並恢復播放

---

## Step 3: Zustand 狀態管理 ✅

- `src/stores/viewer-store.ts` — `currentEvent`、`isPlaying`、`currentTime`、`duration`、`playbackRate`、`volume`、`isMuted`、`focusedCamera`、`layoutMode`、`cameraCount` 及對應 actions（含 `focusCamera` / `unfocusCamera`）
- `src/stores/event-store.ts` — `events`、`filteredEvents`、`activeFilter`、`isLoading`、`error` 及 actions，含非同步 `enrichEvents`（讀取 `event.json` + `thumb.png`）

---

## Step 4: UI 組件 — 影片播放器 ✅

**實際狀態：** 完成，修復多個 Bug，新增 focus 模式改善。

### 已修復的 Bug

**Bug 1 — play 按鈕不作用**
- 原因：Zustand `play()` 只更新 state，未呼叫 `videoElement.play()`
- 修復：`VideoGrid` 加 `useEffect([isPlaying])` 對所有 video element 呼叫 `.play()/.pause()`

**Bug 2 — ref 永遠是 null**
- 原因：三元運算判斷 `null` 導致永遠傳 `undefined` 給 `ref`
- 修復：改用 `React.createRef<HTMLVideoElement>()` 直接傳入

**Bug 3 — 初次載入 duration=0、時間軸無法 seek**
- 原因：`videoFile.blobUrl = url` 直接修改物件屬性，不觸發 React re-render，`<video>` 無 `src`，`loadedmetadata` 永遠不觸發
- 修復：blob URL 改用 `useState` 管理；事件處理改為 React 合成事件 prop（`onLoadedMetadata`、`onTimeUpdate`、`onEnded`）

**Bug 4 — PlaybackControls 被版面裁掉**
- 原因：`h-screen + h-full + marginTop: 3.5rem` 溢出 56px，`overflow-hidden` 裁掉底部
- 修復：改用 `flex flex-col + flex-1 min-h-0` 全鏈結構

**Bug 5 — Focus 模式切換鏡頭後不同步**
- 原因：`focusedCamera` 改變時，React 重新掛載移動位置的 `<video>` 元素，新元素從 `currentTime=0` 開始
- 修復：`useEffect([focusedCamera, layoutMode])` 用 `requestAnimationFrame` 輪詢，等全部 `readyState ≥ 1` 後統一 seek 並恢復播放

### 功能調整

- 音量 UI 隱藏（Tesla 行車記錄無聲音；state/logic 保留）
- DataDashboard 移除（Tesla USB 不含機器可讀遙測數據；`DataDashboard.tsx` 保留備用）
- 後退/前進按鈕改為圓形箭頭 + 「10」標準圖示
- Focus 模式：
  - 右上角「⊞ 返回」按鈕
  - 點擊已放大鏡頭可縮回（hover 顯示「縮小」提示）
  - `Esc` 鍵退出（原有）

### 已完成的檔案

- `src/components/viewer/VideoGrid.tsx` — blob URL state + 同步引擎 + focus 模式
- `src/components/viewer/VideoPlayer.tsx` — `blobUrl`/`isFocused` prop + React event handlers
- `src/components/viewer/DataDashboard.tsx` — 已從 VideoGrid 移除，檔案保留
- `src/components/viewer/PlaybackControls.tsx` — 播放控制列
- `src/components/viewer/Timeline.tsx` — 可拖曳時間軸

---

## Step 5: UI 組件 — 側邊欄與事件列表 ✅

- `src/components/sidebar/Sidebar.tsx` — 可收合側邊欄（手機：overlay 模式；桌面：固定左側）
- `src/components/sidebar/EventList.tsx` — Tab 切換（最近/保存/哨兵）+ 事件計數
- `src/components/sidebar/EventCard.tsx` — 縮圖 + 時間 + 地點 + 時長
- FilterPanel 功能整合在 EventList（未獨立）

---

## Step 6: 頁面整合 ✅

- `src/app/page.tsx` — Landing Page：拖放區（可點擊）+ 選擇資料夾按鈕 + 功能介紹
- `src/app/viewer/page.tsx` — 主播放器頁面
  - 手機：載入事件後**自動打開**側欄；選了事件後**自動關閉**
  - 未選事件時手機顯示「開啟事件列表」按鈕，桌面顯示文字提示
- `src/app/layout.tsx` — 深色主題 + Inter 字體 + SEO meta
- `src/components/layout/Header.tsx` — Logo + 選擇資料夾按鈕
- `src/hooks/useFileAccess.ts` — File System Access API + `<input webkitdirectory>` 降級 + 拖放
- `src/hooks/useKeyboardShortcuts.ts` — Space / ←→ / `,` `.` / Esc

---

## Step 7: 測試與修復 ⚠️

**TypeScript 編譯無誤；** Vitest / Next.js build 在此 ARM64 VM 環境無法執行（缺少原生 binary）。

### 已完成

- [x] `npx tsc --noEmit` — 零 TypeScript 錯誤
- [x] `tests/unit/parser.test.ts` — 更新為 HW4 實際格式，含 session 分組、pillar 後綴映射（TC-U001~U010, U018~U024）

### 待補（待環境支援後執行）

- [ ] `npm run test` — 需要 `@rollup/rollup-linux-arm64-gnu`
- [ ] `npm run build` — 需要 `@next/swc-linux-arm64-gnu`
- [ ] `tests/unit/sync-engine.test.ts` — 需更新以反映整合至 VideoGrid 的同步實作

### 手動驗收 ✅

- [x] 六鏡頭佈局（前大畫面 + 2×2 側面 + 後）
- [x] 深色主題
- [x] 事件分類（最近/保存/哨兵）+ RecentClips session 分組
- [x] 播放/暫停/快進快退/速度切換
- [x] 時間軸（初次載入即可 seek）
- [x] Focus 模式（放大/縮回/切換同步）
- [x] 手機：自動開啟事件列表、選後自動關閉
- [x] 拖放區與選擇按鈕皆可觸發資料夾選取

---

## 已知限制（非 Bug）

- **遙測數據**：Tesla USB 不含機器可讀的速度/排檔/FSD 資料，僅疊加於影片畫面中，無法程式化讀取
- **匯出功能**：規劃中的下一版功能，需要 FFmpeg.wasm
- **地圖**：規劃中，需要 Leaflet + OpenStreetMap 整合

---

## 技術備忘

- HW4 實際 USB 格式驗證於 `/Users/cheni/Desktop/TeslaCam`
- RecentClips session 分組閾值：`SESSION_GAP_MS = 5 * 60 * 1000`（5 分鐘）
- React 19 breaking change：`createRef<T>` 回傳 `RefObject<T | null>`，需注意型別標註
- Blob URL 必須用 `useState` 管理（直接 mutation 不觸發 re-render）

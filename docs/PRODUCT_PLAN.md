# TesVault — 產品企劃書

> **品牌名稱**: TesVault
> **前身代號**: DashView（開發內部用名，已正式更名）
> **版本**: v1.2 (更新: 品牌確定、上線部署計畫、商業化路線圖)
> **日期**: 2026-03-12
> **目標**: 打造一款基於 Web 的 Tesla 行車記錄器播放與管理平台，免安裝、支援最新六鏡頭架構
> **網域**: tesvault.app（待購入）｜**Hosting**: Vercel Pro（$20/月）

---

## 🔧 待修正項目（2026-03-11 調查完成，待實作）

以下問題已調查根本原因，確認修正方案，待確認後實作：

---

### 問題 1：匯出按鈕位置與視覺設計

**現況**：按鈕在 `absolute top-3 left-3`，黑色半透明底 + 深色邊框，視覺上融入影片背景，容易忽略。

**競品參考**：
- **Camzy**：匯出按鈕在播放器底部右側工具列，藍色或白色，固定顯示
- **DaVinci Resolve**：頂部工具列有明顯「Export」橘色按鈕
- **iMovie**：右上角有固定藍色分享按鈕，永遠可見不被影片遮蓋

**建議修正方向**：將匯出按鈕移到播放控制列右側（`PlaybackControls` 區域）。這樣：
- 不會覆蓋在影片上
- 永遠可見，不需要 hover 才出現
- 可以使用顯眼顏色（白色或藍色）不怕與影片背景混在一起

---

### 問題 2：匯出佈局應自動偵測，移除選擇步驟

**現況**：ExportModal 讓用戶手動選「單鏡頭 / 四宮格 / 六宮格」，且有四宮格選項。

**應改為自動對應目前畫面模式**：

| 目前 UI 狀態 | 自動選用匯出佈局 |
|-------------|----------------|
| 六鏡頭總覽 (`layoutMode === 'grid'`, `cameraCount === 6`) | 六宮格 |
| 四鏡頭總覽 (`layoutMode === 'grid'`, `cameraCount === 4`) | 四宮格 |
| 單鏡頭放大 (`layoutMode === 'focus'`) | 單鏡頭（匯出 `focusedCamera`）|

**實作方式**：ExportModal 直接從 `useViewerStore` 讀取 `layoutMode`、`focusedCamera`、`cameraCount`，不再讓用戶選擇。移除四宮格選項（顯示方式保留，但匯出不再獨立提供）。

**UI 文字建議**：在 Modal 頂部顯示「匯出模式：六鏡頭畫面」/「匯出模式：前鏡頭（單鏡頭）」，讓用戶清楚知道會匯出什麼。

---

### 問題 3：匯出影片速度是原片 4×（Bug）

**根本原因**：
```typescript
const PLAYBACK_RATE = 4;  // 影片以 4× 速度播放
const CAPTURE_FPS = 30;   // MediaRecorder 以真實時間 30fps 錄製
```
`canvas.captureStream(30)` 以真實時鐘錄製。影片在真實 10 秒內播放完 40 秒的內容，MediaRecorder 記錄這 10 秒，輸出 10 秒影片 → 播放時是原速 4×。

**修正方案**：將 `PLAYBACK_RATE` 改回 `1`（正常速度播放）。

- 編碼時間從「15秒」變為「42秒」（與片長相同），但仍比 FFmpeg.wasm 的 20+ 分鐘快出天際
- 影片內容完全正確
- 無需 MediaRecorder timestamp 操控

---

### 問題 4：匯出缺少浮水印

**規格書要求**（P1 付費功能為完整 Data Overlay，MVP 版至少應有品牌浮水印）：

**MVP 版浮水印規格（免費層）**：
- 右下角顯示「DashView」品牌文字 + 時間戳記
- 半透明白色，小字體（14px），不遮蓋主要畫面
- 在 `rAF` draw loop 中於每幀最後 `ctx.fillText()` 繪製

**P1 付費版 Data Overlay**（未來）：
- 底部儀表板欄（速度、GPS 座標、時間、Autopilot 狀態）
- 需整合 `event.json` 資料（F006）

**實作位置**：`exportWebCodecs.ts` 的 draw loop 中，在 `for (const { cam, x, y, w, h } of activeRects)` 迴圈之後加入浮水印繪製。

---

### 問題 5：六宮格匯出畫面比例失真

**根本原因**：

實際 Tesla HW4 影片解析度（已量測）：
- 前鏡頭：`2896 × 1876`，比例 = **724:469 ≈ 1.543:1**（接近 3:2）
- 其餘五鏡頭：`1448 × 938`，比例 = **同上 1.543:1**

現行匯出 canvas 佈局：
- 前/後鏡頭：`1280 × 360`（比例 = 3.56:1 → **嚴重拉寬**）
- 側鏡頭：`640 × 360`（比例 = 1.78:1 = 16:9 → **也不正確**）

**修正方案**：依真實比例計算各 cell 尺寸：

| 鏡頭 | 當前尺寸 | 修正尺寸 | 說明 |
|------|---------|---------|------|
| 前（全寬） | 1280 × 360 | **1280 × 829** | 1280 × (469/724) ≈ 829 |
| 左前/右前/左後/右後 | 640 × 360 | **640 × 414** | 640 × (469/724) ≈ 414 |
| 後（全寬） | 1280 × 360 | **1280 × 829** | 同前鏡頭 |
| 總輸出尺寸 | 1280 × 1440 | **1280 × 2486** | 829+414+414+829 |

由於實際比例 (724:469=1.543) 與修正後 cell 比例幾乎完全相符（1280/829=1.544），`ctx.drawImage` 不需要 letterbox 或 crop 即可直接填滿，沒有黑邊也沒有變形。

---

## 🚦 開發進度總覽（2026-03-12 更新）

### 下一階段優先順序

```
✅ Phase 0 完成：MVP 核心功能（播放、匯出、UI）
🔜 Phase 1 進行中：上線部署到外網（tesvault.app）
⏳ Phase 2 待辦：商業化（SEO → 金流 → 廣告）
```

### MVP P0 功能狀態

| ID | 功能 | 狀態 | 備註 |
|----|------|------|------|
| F001 | 檔案匯入（拖放 / File System Access API） | ✅ 完成 | HW4 六鏡頭、SavedClips、SentryClips 均正確解析 |
| F002 | 多鏡頭同步播放（4/6 鏡頭） | ✅ 完成 | HTML5 video × 6，以 front 為基準同步 |
| F003 | 播放控制（速度/音量/逐幀/全螢幕） | ✅ 完成 | 鍵盤快捷鍵全部實作 |
| F004 | 事件瀏覽器（Recent / Saved / Sentry 分類） | ✅ 完成 | 縮圖、大小、時間顯示正常 |
| F005 | 響應式佈局（桌面 / 平板 / 手機） | ✅ 完成 | 桌面六宮格已驗證 |
| F006 | 行車數據儀表板 | ⚠️ 部分 | event.json 尚未整合，顯示靜態佔位元件 |
| F007 | 鏡頭排列設定 | ❌ 暫緩 | 低優先級，上線後再做 |

### P1 進階功能狀態

| ID | 功能 | 狀態 | 備註 |
|----|------|------|------|
| **F102** | **影片匯出** | ✅ 完成 | 硬體加速（canvas + MediaRecorder），42 秒片段約 43 秒完成，含正確時間浮水印 |
| F101 | GPS 地圖整合 | ❌ 未開始 | 上線後 Phase 3 |
| F103 | 分享功能 | ❌ 未開始 | 需後端，Phase 2 之後 |
| F104 | 智慧事件偵測 | ❌ 未開始 | 需 AI API，Phase 3 |

---

### F102 匯出功能詳細狀態（2026-03-12 完成）

**實作架構（雙路線，自動選擇）：**

| 路線 | 技術 | 速度 | 觸發條件 |
|------|------|------|----------|
| 🚀 硬體加速（主要） | `canvas.captureStream()` + `MediaRecorder` | ~1× realtime（比 FFmpeg.wasm 快 20×+） | Chrome 74+、Safari 14.1+、Firefox 101+ |
| 🔧 FFmpeg.wasm（備援） | `@ffmpeg/core` libx264 ultrafast | ~0.1× realtime | 不支援 canvas export 的舊瀏覽器 |

**已解決的所有問題：**
- ✅ CDN CORS / COEP 問題（改用 jsdelivr）
- ✅ 跨域 Worker 限制（`/api/ffmpeg-worker` proxy）
- ✅ `@ffmpeg/core-mt` 32 Worker 死鎖（改回單執行緒）
- ✅ 輸出速度 4× 過快（`PLAYBACK_RATE = 1`）
- ✅ 無浮水印 → 顯示真實拍攝時間（`DashView YYYY-MM-DD HH:MM:SS`）
- ✅ 六宮格比例失真（依 HW4 實際 AR 724:469 重算）
- ✅ Chrome off-screen 媒體節流（容器改用 opacity:0.001 留在 viewport 內）

**E2E 實測結果（2026-03-12）：**
- 測試片段：保存事件，42 秒，單鏡頭前鏡頭
- 輸出時長：**42.94 秒** ✅
- 輸出尺寸：**1280 × 828** ✅（H.264 偶數限制差 1px）
- 浮水印：**`DashView  2026-03-10  19:06:48`** ✅
- 格式：MP4（H.264 硬體加速）

> 技術細節：`docs/EXPORT_FFMPEG_STATUS.md`　研究報告：`docs/EXPORT_RESEARCH.md`

---

## 目錄

1. [競品研究](#1-競品研究)
2. [產品企劃](#2-產品企劃)
3. [商業模式](#3-商業模式)
4. [補充事項](#4-補充事項與風險評估)
5. [測試用例](#5-測試用例)
6. [Claude Code 開發指引](#6-claude-code-開發指引)

---

## 1. 競品研究

### 1.1 全球市場競品

#### 1.1.1 Camzy (iOS) — 主要競品

**概述**: 目前市場上最強的 Tesla 行車記錄器 App，已支援 HW4 六鏡頭同步播放，台灣科技媒體 Angus 電科技評為「特斯拉車主必裝」。版本 1.2.0（2026 年初）。

| 項目 | 內容 |
|------|------|
| 平台 | iOS（需透過 Lightning/USB-C 轉接頭連接 USB） |
| 定價 | **免費下載 + Pro 內購**（終身方案，約幾百元台幣，部落客常提供 15% 折扣碼） |
| 底部 Tab | 三個主 Tab：**瀏覽** / **備份** / **設定** |

**免費版功能**:
- 基本 4 畫面同步播放
- 行車資訊同步觀看（車速、檔位、座標）
- 地圖模式瀏覽與事件點選
- 基本文件管理（單個查看）
- AI 一鍵複製車牌 (Copy All License Plates)

**Pro 版解鎖功能**:
- 進階 6 畫面同步播放（需 HW4 車款）
- 即時地圖同步播放（解鎖軌跡）
- **專業數據浮水印匯出 (Data Overlay)**: 在影片上壓上時速、GPS 座標、檔位、Autopilot/FSD 狀態、加速/煞車踏板紀錄
- 精簡備份模式 (Compact Backup): 僅備份事件觸發前後最重要片段，節省空間
- 無限制批次操作

**六鏡頭 UI 佈局（手機版，關鍵參考）**:
```
┌──────────────────┐
│     ● 前 (前方)    │  ← 主鏡頭，最大畫面
│                    │
├──────────────────┤
│ [D] [24km/h] [GPS]│  ← 數據儀表板 (車速/檔位/座標/Autopilot)
│     手動駕駛        │
├────────┬─────────┤
│ ● 左前  │  ● 右前  │  ← 左前方/右前方 (B 柱鏡頭)
├────────┼─────────┤
│ ● 左後  │  ● 右後  │  ← 左後方/右後方 (翼子板鏡頭)
├────────┴─────────┤
│     ● 後 (後方)    │  ← 後方鏡頭
└──────────────────┘
[時間軸進度條 0:00 ————————— -10:46]
[⏮10] [▶] [⏭10] [🔊]
```

**匯出介面佈局**:
```
┌──────────────────┐
│  多鏡頭影片預覽     │
├──────────────────┤
│ 時間軸 (可拖曳選擇) │
│ ⏱ 0:00 → 10:46   │
│ [🔘 事件點前後片段]  │
├──────────────────┤
│ 浮水印選項:         │
│ [⏱時間] [🚗速度]   │
│ [📍GPS座標]        │
│ [🤖AP/FSD/ACC]    │
├──────────────────┤
│ 選擇鏡頭:          │
│ ● 前  ● 後  ● 左  ● 右│
├──────────────────┤
│ [  匯出 (47秒)  ]  │
└──────────────────┘
```

**設定頁選項**: 語言（繁體中文）、單位（km/h | mph）、鏡頭排列（左|右 或 右|左）

**事件瀏覽 UI**:
- 分類：最近 / 保存 / 哨兵（各顯示數量如 "最近 (61)"）
- 每個事件卡片：縮圖 + 地點名稱（如「中壢區 環北路」）+ 日期時間 + 影片時長
- 地圖模式：Apple Maps 底圖 + 紅色群集圖標（顯示該區域事件數量）
- 點擊地圖紅點跳轉到該地點的事件列表

**事件詳情頁**:
- 地圖顯示行車路線
- 資訊列：類型（已儲存）、來源（USB）、片段數（11個片段）、原因（手動儲存/喇叭觸發）、檔案大小（1.59GB）、時長（10:46）、地址（完整中文地址）

**用戶流程**:
1. 將 Tesla USB 隨身碟透過轉接頭插上 iPhone
2. 打開 Camzy App → 點擊「選擇 TeslaCam 資料夾」
3. 指向 TESLADRIVE > TeslaCam 資料夾
4. App 自動掃描並分類為「哨兵 (Sentry)」或「行車 (Dashcam)」
5. 選擇事件 → 六鏡頭同步播放 → 匯出/分享

**優勢**: UI 極為精緻、六鏡頭佈局直覺、Data Overlay 證據等級匯出、AI 車牌辨識
**劣勢**: 僅限 iOS App、無 Web 版、需購買轉接頭、無雲端儲存/分享連結
**實現難度**: ★★★★☆（Data Overlay 與 AI 車牌辨識增加複雜度）

---

#### 1.1.2 SentryView (iOS)

| 項目 | 內容 |
|------|------|
| 平台 | iOS |
| 定價 | $3.99 USD 一次性購買 |
| 核心功能 | Sentry 事件專注瀏覽、快速篩選事件類型、影片分享 |
| UI 特色 | 事件為中心的列表視圖、單鏡頭大畫面 + 切換按鈕 |
| 支援鏡頭 | 前/左/右/車內（4 鏡頭） |
| 優點 | 專注 Sentry Mode、事件篩選做得好 |
| 缺點 | 功能較少、無地圖、無 Android 版、不支援新鏡頭 |
| 實現難度 | ★★☆☆☆（功能精簡，實現相對簡單） |

---

#### 1.1.3 TeslaCam Viewer / Tesla Dashcam Viewer (多平台)

| 項目 | 內容 |
|------|------|
| 平台 | Windows / macOS / 部分有 Web 版 |
| 定價 | 免費（開源）/ $2.99-$9.99（商業版） |
| 核心功能 | 多鏡頭同步播放、時間軸、事件瀏覽、基本影片匯出 |
| UI 特色 | 桌面應用風格、上方四宮格影片、下方時間軸控制條 |
| 支援鏡頭 | 前/左/右/車內（4 鏡頭） |
| 優點 | 桌面效能佳、大螢幕體驗好 |
| 缺點 | 需下載安裝、UI 較陽春、更新頻率低 |
| 實現難度 | ★★☆☆☆（基礎桌面播放器） |

---

#### 1.1.4 TeslaUSB + tesla_dashcam (開源)

| 項目 | 內容 |
|------|------|
| 平台 | Raspberry Pi / CLI 工具 |
| 定價 | 免費（MIT License） |
| 核心功能 | 自動備份到 NAS/雲端、影片拼接合併、多鏡頭合併成單一影片 |
| UI 特色 | 無 GUI，命令列工具 |
| 支援鏡頭 | 前/左/右/車內（4 鏡頭） |
| 優點 | 高度客製化、自動化流程、開源社群維護 |
| 缺點 | 需要技術背景、無即時瀏覽功能 |
| 實現難度 | ★★★★☆（自動化流程複雜，但無 UI） |

**參考價值**: ffmpeg 拼接多鏡頭的命令和參數可以參考此專案。

---

#### 1.1.5 TezLab (iOS/Android)

| 項目 | 內容 |
|------|------|
| 平台 | iOS / Android |
| 定價 | 免費 + Pro $3.99/月 |
| 核心功能 | Tesla 車輛監控、充電追蹤、行程記錄（dashcam 為附加功能） |
| UI 特色 | 儀表板風格、統計圖表豐富 |
| 支援鏡頭 | 有限的 dashcam 支援 |
| 優點 | 完整的 Tesla companion app、社群功能 |
| 缺點 | Dashcam 不是核心功能、需 Tesla API 連接 |
| 實現難度 | ★★★★☆（需整合 Tesla API） |

---

#### 1.1.6 現有 Web-based 方案

| 方案 | 說明 |
|------|------|
| teslacamviewer.com | 早期 Web 版播放器，功能有限，僅支援基本播放 |
| GitHub Pages 專案 | 社群開發的簡易 HTML+JS 播放器，拖放檔案播放 |
| sentrycam.app | Web 應用，支援拖放 USB 資料夾，基本多鏡頭播放 |

**現有 Web 方案的共同問題**:
- 僅支援 4 鏡頭（front / back / left_repeater / right_repeater）
- 無 GPS 地圖整合
- 無事件智慧分類
- UI/UX 粗糙，缺乏現代設計
- 效能不佳（多鏡頭同步卡頓）
- 無雲端儲存或分享功能
- **全部不支援最新六鏡頭架構**

---

### 1.2 台灣本地市場

#### 1.2.1 市場概況

- 台灣 Tesla 累計銷量約 40,000-50,000 輛（截至 2025 年底），年增率約 20-30%
- Model 3 / Model Y 為主力車型，2024 Highland / 2025 Juniper 逐步交車
- 台灣車主社群活躍：PTT Car 板、Mobile01 汽車頻道、Facebook「Tesla 台灣車主群」（數萬成員）
- 台灣車主常見需求：事故舉證、停車場 Sentry 監控、行車紀錄存檔

#### 1.2.2 台灣車主現行方案

| 方案 | 使用率 | 說明 |
|------|--------|------|
| Tesla 原廠車機播放 | 最高 | 直接在車上看，但螢幕小、操作不便、無法匯出 |
| Comzy App | 中高 | 最多人推薦的第三方 App |
| VLC 播放器 | 中 | 直接用電腦開 MP4，但無多鏡頭同步 |
| iPhone 檔案 App | 低 | 直接在 iOS Files 播放 MP4，無同步 |
| Windows 檔案總管 | 低 | 逐一開啟 MP4 檔案 |

#### 1.2.3 台灣市場痛點

1. **操作繁瑣**: 需要拔 USB → 接電腦/手機 → 下載 App → 找到檔案 → 逐一播放
2. **多鏡頭同步困難**: VLC 等通用播放器無法同步多鏡頭
3. **事件定位慢**: Sentry Mode 產生大量事件片段，找到關鍵事件很費時
4. **語言障礙**: 多數 App 僅英文介面，台灣長輩車主使用困難
5. **分享不便**: 出事故需要影片舉證時，分享流程繁瑣
6. **儲存管理**: USB 空間管理困難，不知道哪些可以刪除
7. **新鏡頭不支援**: 2024+ 車型的新鏡頭配置，現有 App 尚未完全支援

#### 1.2.4 台灣市場金流生態

| 金流服務 | 適用性 | 手續費 | 我們是否採用 |
|----------|--------|--------|-------------|
| 綠界 ECPay | 最適合（信用卡+超商代碼+ATM） | 2.75%-3.0% | ✅ 主要金流 |
| LINE Pay | 高覆蓋率，台灣用戶熟悉 | 3.0% | ✅ 行動支付 |
| 藍新 NewebPay | 適合（信用卡+WebATM） | 2.5%-2.8% | ❌ 暫不採用 |
| Apple IAP / Google Play | 若有 App 版本 | 15%-30% | ❌ 純 Web 不需要 |
| Stripe | 國際支付 | 2.9% + $0.30 | ❌ 未來國際化時再加入 |

---

### 1.3 競品功能矩陣

| 功能 | Camzy | SentryView | TeslaCam Viewer | TezLab | Web方案 | **我們(目標)** |
|------|:-----:|:----------:|:---------------:|:------:|:------:|:----------:|
| 多鏡頭同步播放 | ✅ | ✅ | ✅ | ❌ | ⚠️ | ✅ |
| 六鏡頭支援 (HW4) | ✅ Pro | ❌ | ❌ | ❌ | ❌ | ✅ |
| Web 免安裝 | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| GPS 地圖疊加 | ✅ | ❌ | ⚠️ | ✅ | ❌ | ✅ |
| 地圖事件群集瀏覽 | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Sentry 事件分類 | ✅ | ✅ | ⚠️ | ❌ | ❌ | ✅ |
| 時間軸標記 | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| **Data Overlay 匯出** | ✅ Pro | ❌ | ❌ | ❌ | ❌ | ✅ 付費 |
| **AI 車牌辨識** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ 付費 |
| **精簡備份** | ✅ Pro | ❌ | ❌ | ❌ | ❌ | ✅ |
| 行車數據顯示 | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ |
| 影片匯出/合併 | ✅ | ⚠️ | ✅ | ❌ | ❌ | ✅ |
| 中文介面 | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| 影片分享連結 | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ 付費 |
| 雲端儲存 | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ 付費 |
| 影片裁剪 | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| 批次處理 | ✅ Pro | ❌ | ⚠️ | ❌ | ❌ | ✅ |
| 深色主題 | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ |
| 鍵盤快捷鍵 | N/A | N/A | ✅ | N/A | ❌ | ✅ |
| 離線使用 (PWA) | N/A | N/A | N/A | N/A | ❌ | ✅ |
| **事故報告生成** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ 付費 |

✅ = 完整支援 | ⚠️ = 部分支援 | ❌ = 不支援

---

## 2. 產品企劃

### 2.1 產品定位

**一句話定位**: 「第一款支援 Tesla 六鏡頭、Web 免安裝的專業行車記錄器播放器」

**目標用戶**:
- 主要：Tesla 車主（Model 3/Y/S/X/Cybertruck）
- 次要：車隊管理者、保險理賠人員、交通事故處理人員

**核心價值主張**:
1. **免安裝**: 打開瀏覽器即可使用，不佔手機/電腦空間
2. **六鏡頭原生支援**: 第一款完整支援 2024+ Tesla 新鏡頭配置
3. **繁中在地化**: 台灣車主友善的中文介面
4. **智慧分類**: AI 輔助事件分類與摘要，快速找到重要片段
5. **一鍵分享**: 生成分享連結，方便事故舉證

---

### 2.2 功能規格 (Feature Specification)

#### 2.2.1 P0 — MVP 必備功能（第一版）

```yaml
feature_group: core_playback
features:
  - id: F001
    name: 檔案匯入
    description: 支援拖放或選擇 TeslaCam 資料夾/USB 裝置
    acceptance_criteria:
      - 支援拖放整個 TeslaCam 資料夾到瀏覽器
      - 支援 File System Access API 直接選擇 USB 裝置資料夾
      - 自動解析 TeslaCam 資料夾結構 (RecentClips / SavedClips / SentryClips)
      - 顯示載入進度條
      - 錯誤處理：非 TeslaCam 資料夾時顯示明確錯誤訊息
    tech_notes: |
      使用 File System Access API (showDirectoryPicker)
      降級方案: <input type="file" webkitdirectory>
      需處理大資料夾（可能含數 GB 影片）的異步掃描

  - id: F002
    name: 多鏡頭同步播放
    description: 同時播放 4-6 個鏡頭的影片，保持時間同步
    acceptance_criteria:
      - 支援 4 鏡頭模式（front / back / left_repeater / right_repeater）
      - 支援 6 鏡頭模式（front / back / left_repeater / right_repeater / left_rear / right_rear）
      - 鏡頭間時間偏差 < 100ms
      - 提供單鏡頭放大模式（點擊任一鏡頭全螢幕播放）
      - 播放/暫停/快進/快退同步控制
    tech_notes: |
      使用 HTML5 <video> 元素 × N
      主時鐘同步策略：以 front 鏡頭為基準
      requestAnimationFrame 迴圈檢查並校正時間差
      Canvas 合併渲染作為備選方案

  - id: F003
    name: 播放控制
    description: 完整的影片播放控制功能
    acceptance_criteria:
      - 播放/暫停 (Space 鍵)
      - 快進/快退 5 秒 (左右方向鍵)
      - 播放速度控制 (0.25x / 0.5x / 1x / 1.5x / 2x / 4x)
      - 音量控制（前鏡頭音訊）
      - 全螢幕模式
      - 時間軸拖曳跳轉
      - 逐幀前進/後退 (, 和 . 鍵)
    tech_notes: |
      鍵盤快捷鍵使用 keydown 事件
      播放速度：HTMLVideoElement.playbackRate
      逐幀：video.currentTime += 1/30

  - id: F004
    name: 事件瀏覽器
    description: 以列表形式顯示所有 dashcam 事件，支援篩選排序
    acceptance_criteria:
      - 分類顯示：Recent Clips / Saved Clips / Sentry Events
      - 按時間排序（新到舊 / 舊到新）
      - 顯示事件縮圖（如有 thumbnail）
      - 顯示事件基本資訊：時間、類型、持續時間、檔案大小
      - 點擊事件直接跳到播放
      - 支援搜尋（按日期範圍篩選）
    tech_notes: |
      解析資料夾結構產生事件列表
      縮圖：讀取 SentryClips 的 thumbnail jpg 或從影片第一幀擷取
      使用虛擬捲動（virtual scroll）處理大量事件

  - id: F005
    name: 響應式佈局
    description: 適配桌面、平板、手機各種螢幕尺寸
    acceptance_criteria:
      - 桌面 (>1024px)：六宮格/四宮格 + 側邊事件列表
      - 平板 (768-1024px)：四宮格 + 底部事件列表
      - 手機 (<768px)：單鏡頭 + 滑動切換 + 底部事件列表
      - 支援橫豎屏切換
    tech_notes: |
      CSS Grid + Flexbox
      使用 CSS Container Queries 做組件級別響應
      手機版使用 touch swipe 手勢切換鏡頭
```

  - id: F006
    name: 行車數據儀表板 (Data Dashboard)
    description: 在播放畫面中即時顯示行車數據
    acceptance_criteria:
      - 顯示即時車速 (km/h 或 mph，可切換)
      - 顯示當前檔位 (P/R/N/D)
      - 顯示 GPS 經緯度座標
      - 顯示駕駛模式 (手動駕駛 / Autopilot / FSD)
      - 數據與影片時間軸同步
      - 數據列嵌入在前方主鏡頭與側面鏡頭之間
    tech_notes: |
      數據來源: Tesla event.json 或影片內嵌 metadata
      若無內嵌數據: 透過 Tesla API 取得歷史行程數據
      備選: 讓用戶手動導入 Tesla 行車資料 CSV

  - id: F007
    name: 鏡頭排列設定
    description: 允許用戶自訂鏡頭排列方式
    acceptance_criteria:
      - 支援「左|右」和「右|左」排列偏好
      - 設定保存在 localStorage / 用戶偏好
      - 4 鏡頭與 6 鏡頭模式各自獨立設定
    tech_notes: |
      參考 Camzy 設定頁的「鏡頭排列」選項

#### 2.2.2 P1 — 進階功能（第二版）

```yaml
feature_group: advanced
features:
  - id: F101
    name: GPS 地圖整合
    description: 在地圖上顯示行車路線，與影片時間軸同步
    acceptance_criteria:
      - 解析 Tesla GPS 資料（如有嵌入影片 metadata 或 event.json）
      - 在地圖上繪製行車軌跡
      - 地圖標記與影片時間軸同步
      - 點擊地圖上的點跳轉到對應影片時間
      - Sentry 事件在地圖上顯示圖標
    tech_notes: |
      地圖：Mapbox GL JS 或 Leaflet + OpenStreetMap
      GPS 資料來源：MP4 metadata 或 event.json
      需研究 Tesla 實際嵌入 GPS 的方式

  - id: F106
    name: 證據等級影片匯出 — Data Overlay (付費功能)
    description: 匯出影片時自動疊加行車數據浮水印，達到證據等級
    acceptance_criteria:
      - 浮水印包含：精準時間戳記、GPS 座標、即時車速、檔位
      - 浮水印包含：Autopilot/FSD 開啟狀態、加速/煞車踏板紀錄
      - 浮水印位置在影片底部，形成「數據儀表板」條
      - 用戶可勾選要包含的浮水印項目（時間/速度/GPS座標/AP狀態）
      - 匯出格式: MP4 (H.264)
      - 匯出時間範圍可選: 全片段 或 事件點前後片段
    tech_notes: |
      使用 FFmpeg.wasm 將數據渲染到影片底部
      數據來源同 F006 行車數據儀表板
      浮水印渲染: Canvas 繪製 → 合成到影片幀
      此為核心付費功能，觸發單次付費

  - id: F107
    name: AI 車牌辨識 — Copy All License Plates (付費功能)
    description: 自動偵測影片中的車牌號碼，一鍵複製
    acceptance_criteria:
      - 播放時自動掃描畫面中出現的車輛與車牌
      - 按下「Copy All」一鍵複製所有偵測到的車牌號碼
      - 支援前/後/側面鏡頭捕捉到的車牌
      - 辨識結果顯示在介面上供確認
      - 複製到剪貼簿，方便貼到檢舉表單或備忘錄
    tech_notes: |
      前端: TensorFlow.js + 車牌偵測模型 (YOLO/SSD)
      後端: 使用 OCR API (Google Vision / Anthropic Claude Vision)
      台灣車牌格式: ABC-1234 或 AB-1234
      混合架構: 前端偵測車輛位置 → 裁剪車牌區域 → 後端 OCR
      此為核心付費功能

  - id: F108
    name: 精簡備份 (Compact Backup)
    description: 智慧分析影片，僅備份事件觸發前後最重要片段
    acceptance_criteria:
      - 分析事件時間軸，識別關鍵時段
      - 提供「完整備份」與「精簡備份」兩種模式
      - 精簡備份顯示預估大小（相比完整備份節省多少）
      - 備份到用戶本地下載或雲端
    tech_notes: |
      需分析 Sentry 事件的 event.json 觸發時間
      精簡範圍: 事件觸發前 10 秒 ~ 後 20 秒
      使用 FFmpeg.wasm 裁剪影片片段

  - id: F102
    name: 影片匯出與合併
    description: 將多鏡頭影片合併匯出為單一影片或裁剪片段
    acceptance_criteria:
      - 選擇時間範圍裁剪
      - 選擇鏡頭組合（單鏡頭 / 四宮格 / 六宮格）
      - 匯出格式：MP4 (H.264)
      - 匯出品質選擇（原畫質 / 720p / 1080p）
      - 加入時間水印
      - 顯示匯出進度
    tech_notes: |
      方案 A: 使用 FFmpeg.wasm 在瀏覽器內合併（較慢但離線可用）
      方案 B: 上傳到後端伺服器合併（較快但需上傳）
      建議 MVP 先用 FFmpeg.wasm，後續加入伺服器方案

  - id: F103
    name: 分享功能
    description: 生成可分享的影片連結
    acceptance_criteria:
      - 選擇片段後一鍵生成分享連結
      - 分享連結可設定有效期（24h / 7d / 30d / 永久）
      - 分享頁面可直接播放，不需要帳號
      - 支援密碼保護（可選）
    tech_notes: |
      需要雲端儲存後端
      上傳影片到 S3 / GCS / Cloudflare R2
      短連結服務
      這是付費功能的主要觸發點

  - id: F104
    name: 智慧事件偵測
    description: 自動辨識影片中的重要事件
    acceptance_criteria:
      - 偵測碰撞/急煞（基於影片畫面變化或 metadata）
      - 偵測有人接近車輛（Sentry 相關）
      - 為每個事件生成文字摘要
      - 事件重要程度評分
    tech_notes: |
      前端：使用 TensorFlow.js 做基本物件偵測
      後端：使用 AI API 做更精確的事件分析
      混合架構：前端快速篩選 + 後端精確分析
```

#### 2.2.3 P2 — 差異化功能（第三版）

```yaml
feature_group: premium
features:
  - id: F201
    name: 雲端備份與管理
    description: 將 dashcam 影片備份到雲端，跨裝置存取
    tech_notes: 使用 Cloudflare R2 或 AWS S3 儲存

  - id: F202
    name: AI 事故報告生成
    description: 基於影片內容自動生成事故報告（含截圖、時間線、描述）
    tech_notes: 後端使用 Vision AI API 分析關鍵幀

  - id: F203
    name: 車隊管理
    description: 多車輛儀表板，適用於商業車隊
    tech_notes: 需要多租戶架構

  - id: F204
    name: PWA 離線支援
    description: 安裝為 PWA，支援離線使用
    tech_notes: Service Worker + Cache API

  - id: F205
    name: 多語系
    description: 繁體中文（默認）、簡體中文、英文、日文
    tech_notes: i18n 框架 (react-intl 或 next-intl)
```

---

### 2.3 UI 設計規範

#### 2.3.1 設計原則

1. **深色優先**: 行車記錄器影片多在夜間/低光環境，深色主題減少眼睛疲勞
2. **影片為中心**: 播放區域佔頁面 60-70%
3. **最少點擊**: 核心操作不超過 2 次點擊到達
4. **即時回饋**: 每個操作都有視覺回饋（載入動畫、轉場效果）

#### 2.3.2 頁面結構

**桌面版主佈局**:
```
┌──────────────────────────────────────────────────────────────┐
│  Header: Logo | [選擇資料夾] | 設定⚙️ | 帳號 | 語言切換 🌐  │
├───────────────┬──────────────────────────────────────────────┤
│               │                                              │
│  側邊欄 (可收合) │           ● 前 (前方主鏡頭)                  │
│               │              最大畫面                         │
│  📁 事件列表    │  ─────────────────────────────────────       │
│  ├ 最近 (61)   │  [D] [24km/h] [手動駕駛] [📍GPS座標]         │
│  ├ 保存 (51)   │  ─────────────────────────────────────       │
│  └ 哨兵 (65)   │  ┌──────┬──────┬──────┬──────┐              │
│               │  │● 左前 │● 右前│● 左後│● 右後│              │
│  🔍 搜尋/篩選  │  └──────┴──────┴──────┴──────┘              │
│  📅 日期範圍    │           ● 後 (後方鏡頭)                    │
│               │  ─────────────────────────────────────       │
│  🗺️ 地圖模式   │  [時間軸 ━━━━━━━━━━━━━━━━━━━━━ -10:46]      │
│  (群集紅點)    │  [⏮10][▶/⏸][⏭10] [1x▾] [🔊] [⛶]          │
│               │                                              │
│  📋 事件詳情    │  [匯出🎬] [分享🔗] [截圖📸] [車牌🚗]          │
│  (大小/時長/   │                                              │
│   地址/原因)   │                                              │
├───────────────┴──────────────────────────────────────────────┤
│  Footer: 版本 | 回饋 | 隱私政策 | 免責聲明                      │
└──────────────────────────────────────────────────────────────┘
```

**手機版主佈局（參考 Camzy 底部 Tab）**:
```
┌──────────────────┐
│  < 返回  事件名稱  │
├──────────────────┤
│   (六鏡頭播放區)   │
│   參見 2.3.3 佈局  │
├──────────────────┤
│  [匯出][分享][車牌] │
├──────────────────┤
│ [📹瀏覽][📤備份][⚙設定] │  ← 底部 Tab (同 Camzy)
└──────────────────┘
```

#### 2.3.3 六鏡頭佈局方案（參考 Camzy 設計）

> **設計原則**: 完全參考 Camzy 的佈局邏輯。六顆鏡頭為：前、後、左前、右前、左後、右後。
> 前方主鏡頭佔最大面積，中間嵌入行車數據儀表板，側面鏡頭 2×2 排列，後方鏡頭在最下方。

**桌面版 — Camzy 風格橫向適配（推薦）**:
```
┌───────────────────────────────────────────────────────────┐
│                                                           │
│                      ● 前 (前方主鏡頭)                      │
│                         最大畫面                            │
│                                                           │
├───────────────────────────────────────────────────────────┤
│  [D檔] [🚗 24 km/h] [手動駕駛] [📍24.89°N 121.52°E]      │  ← 數據儀表板
├─────────────┬─────────────┬─────────────┬─────────────────┤
│   ● 左前     │   ● 右前     │   ● 左後     │     ● 右後      │
│  (B柱左)     │  (B柱右)     │ (翼子板左)   │   (翼子板右)     │
├─────────────┴─────────────┴─────────────┴─────────────────┤
│                      ● 後 (後方鏡頭)                        │
├───────────────────────────────────────────────────────────┤
│  [時間軸 0:00 ━━━━━━━━━━━━━━━━━━━━━━━━ -10:46]            │
│  [⏮10] [◀] [▶/⏸] [▶] [⏭10]  [1x ▾]  [🔊]  [⛶全螢幕]    │
└───────────────────────────────────────────────────────────┘
```

**手機版 — 與 Camzy 一致的縱向堆疊**:
```
┌──────────────────┐
│     ● 前 (前方)    │  ← 主鏡頭，佔約 35% 高度
│                    │
├──────────────────┤
│ [D][24km/h][GPS]  │  ← 數據儀表板 (速度/檔位/座標)
│    手動駕駛         │
├────────┬─────────┤
│ ● 左前  │  ● 右前  │  ← 2×2 側面鏡頭
├────────┼─────────┤
│ ● 左後  │  ● 右後  │
├────────┴─────────┤
│     ● 後 (後方)    │  ← 後方鏡頭
├──────────────────┤
│ ━━━━━━━━━━━━━━━━ │  ← 時間軸
│ [⏮10] [▶] [⏭10]  │
└──────────────────┘
```

**四鏡頭模式（舊車型 / 免費版）**:
```
桌面:                              手機:
┌─────────┬─────────┐            ┌──────────────────┐
│  ● 前    │  ● 後   │            │     ● 前 (前方)    │
├─────────┼─────────┤            ├────────┬─────────┤
│  ● 左    │  ● 右   │            │ ● 左   │  ● 右   │
└─────────┴─────────┘            ├────────┴─────────┤
                                  │     ● 後 (後方)    │
                                  └──────────────────┘
```

**單鏡頭放大模式（點擊任一鏡頭觸發）**:
```
┌──────────────────────────────────────────┐
│                                          │
│          選中的鏡頭 (全幅放大)              │
│                                          │
│                                          │
├──────┬──────┬──────┬──────┬──────────────┤
│ 前   │ 左前 │ 右前 │ 左後 │ 右後 │  後   │  ← 底部縮圖列
└──────┴──────┴──────┴──────┴──────────────┘
```

**鏡頭排列設定**: 支援「左|右」與「右|左」排列偏好（同 Camzy 設定頁）

#### 2.3.4 色彩方案

```css
/* 深色主題 (預設) */
--bg-primary: #0a0a0a;
--bg-secondary: #141414;
--bg-card: #1a1a1a;
--border: #2a2a2a;
--text-primary: #e5e5e5;
--text-secondary: #a3a3a3;
--accent: #3b82f6;       /* 藍色 - 主要操作 */
--accent-hover: #2563eb;
--danger: #ef4444;        /* 紅色 - Sentry 事件 */
--warning: #f59e0b;       /* 黃色 - 警告 */
--success: #22c55e;       /* 綠色 - 正常 */

/* 淺色主題 */
--bg-primary: #ffffff;
--bg-secondary: #f5f5f5;
--bg-card: #ffffff;
--border: #e5e5e5;
--text-primary: #171717;
--text-secondary: #525252;
```

---

### 2.4 用戶交互流程（User Flow）

#### 2.4.1 首次使用流程

```
[用戶打開網站]
    │
    ▼
[Landing Page - 產品介紹 + CTA]
    │
    ├── [拖放 TeslaCam 資料夾] ──► [自動解析] ──► [進入播放器]
    │
    └── [點擊「選擇資料夾」按鈕]
            │
            ▼
        [系統檔案選擇器]
            │
            ▼
        [掃描資料夾結構]
            │
            ├── [成功] ──► [顯示事件列表 + 播放器]
            │
            └── [失敗] ──► [錯誤提示 + 說明正確的資料夾格式]
```

#### 2.4.2 核心使用流程

```
[事件列表]
    │
    ▼
[選擇一個事件/片段]
    │
    ▼
[載入該事件的所有鏡頭影片]
    │
    ▼
[多鏡頭同步播放]
    │
    ├── [點擊單一鏡頭] ──► [放大該鏡頭] ──► [再次點擊返回多宮格]
    │
    ├── [使用時間軸] ──► [跳轉到特定時間點]
    │
    ├── [調整播放速度] ──► [0.25x ~ 4x]
    │
    └── [操作按鈕]
            ├── [匯出] ──► [選擇範圍+鏡頭+品質] ──► [處理中] ──► [下載]
            ├── [分享] ──► [上傳雲端] ──► [生成連結] ──► [複製連結]
            ├── [截圖] ──► [合併當前所有鏡頭畫面為一張圖] ──► [下載]
            └── [下載] ──► [下載原始檔案]
```

#### 2.4.3 Sentry 事件處理流程

```
[Sentry 事件列表]
    │
    ▼
[依時間排序顯示事件]
    │
    ├── [事件卡片顯示: 縮圖 + 時間 + 類型標籤]
    │
    ▼
[點擊事件]
    │
    ▼
[播放事件前後 30 秒影片]
    │
    ├── [標記為「重要」] ──► [加入收藏]
    ├── [標記為「忽略」] ──► [從列表隱藏]
    └── [一鍵分享] ──► [上傳 + 生成連結]
```

---

### 2.5 技術架構（供 Claude Code 參考）

#### 2.5.1 技術選型

```yaml
frontend:
  framework: Next.js 14+ (App Router)
  language: TypeScript
  styling: Tailwind CSS
  state_management: Zustand
  video_player: HTML5 Video API + custom sync layer
  map: Mapbox GL JS (或 Leaflet)
  video_processing: FFmpeg.wasm
  file_access: File System Access API
  pwa: next-pwa

backend:
  runtime: Node.js (Edge Runtime for Vercel)
  framework: Next.js API Routes
  database: PostgreSQL (Supabase 或 Neon)
  storage: Cloudflare R2 (S3 compatible)
  auth: NextAuth.js (或 Clerk)
  payment: 綠界 ECPay + LINE Pay
  ai: Anthropic Claude API (事件分析)
  analytics: PostHog (或 Plausible)

deployment:
  hosting: Vercel
  cdn: Cloudflare
  domain: dashview.app (或類似)
  ci_cd: GitHub Actions

monitoring:
  error_tracking: Sentry
  performance: Vercel Analytics
  uptime: BetterUptime
```

#### 2.5.2 專案結構

```
dashview/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── page.tsx              # Landing page
│   │   ├── viewer/
│   │   │   └── page.tsx          # 主播放器頁面
│   │   ├── share/
│   │   │   └── [id]/
│   │   │       └── page.tsx      # 分享連結播放頁
│   │   ├── pricing/
│   │   │   └── page.tsx          # 定價頁
│   │   ├── api/
│   │   │   ├── upload/
│   │   │   │   └── route.ts      # 影片上傳 API
│   │   │   ├── share/
│   │   │   │   └── route.ts      # 分享連結 API
│   │   │   ├── payment/
│   │   │   │   ├── ecpay/
│   │   │   │   │   └── route.ts  # 綠界金流
│   │   │   │   └── linepay/
│   │   │   │       └── route.ts  # LINE Pay
│   │   │   └── ai/
│   │   │       └── analyze/
│   │   │           └── route.ts  # AI 事件分析
│   │   └── layout.tsx
│   │
│   ├── components/
│   │   ├── viewer/
│   │   │   ├── VideoGrid.tsx         # 多鏡頭網格
│   │   │   ├── VideoPlayer.tsx       # 單一影片播放器
│   │   │   ├── SyncController.tsx    # 同步控制器
│   │   │   ├── Timeline.tsx          # 時間軸組件
│   │   │   ├── PlaybackControls.tsx  # 播放控制列
│   │   │   └── CameraSelector.tsx    # 鏡頭選擇器
│   │   ├── sidebar/
│   │   │   ├── EventList.tsx         # 事件列表
│   │   │   ├── EventCard.tsx         # 事件卡片
│   │   │   ├── FilterPanel.tsx       # 篩選面板
│   │   │   └── MiniMap.tsx           # 小地圖
│   │   ├── export/
│   │   │   ├── ExportDialog.tsx      # 匯出對話框
│   │   │   └── ShareDialog.tsx       # 分享對話框
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Footer.tsx
│   │   └── ui/                       # 共用 UI 組件
│   │       ├── Button.tsx
│   │       ├── Dialog.tsx
│   │       ├── Slider.tsx
│   │       └── ...
│   │
│   ├── lib/
│   │   ├── tesla/
│   │   │   ├── parser.ts            # TeslaCam 資料夾解析器
│   │   │   ├── types.ts             # Tesla 相關類型定義
│   │   │   ├── camera-config.ts     # 鏡頭配置（4鏡頭/6鏡頭）
│   │   │   └── metadata.ts          # 影片 metadata 解析
│   │   ├── video/
│   │   │   ├── sync-engine.ts       # 多影片同步引擎
│   │   │   ├── playback.ts          # 播放控制邏輯
│   │   │   └── export.ts            # FFmpeg.wasm 匯出
│   │   ├── storage/
│   │   │   ├── file-access.ts       # File System Access API 封裝
│   │   │   └── cloud.ts             # 雲端儲存操作
│   │   ├── payment/
│   │   │   ├── ecpay.ts             # 綠界金流封裝
│   │   │   ├── linepay.ts           # LINE Pay 封裝
│   │   │   └── transaction.ts       # 交易記錄與功能解鎖
│   │   └── utils/
│   │       ├── format.ts            # 格式化工具
│   │       └── i18n.ts              # 國際化
│   │
│   ├── stores/
│   │   ├── viewer-store.ts          # 播放器狀態
│   │   ├── event-store.ts           # 事件列表狀態
│   │   └── app-store.ts             # 全局應用狀態
│   │
│   ├── hooks/
│   │   ├── useVideoSync.ts          # 影片同步 hook
│   │   ├── useTeslaCam.ts           # TeslaCam 資料 hook
│   │   ├── useKeyboardShortcuts.ts  # 鍵盤快捷鍵 hook
│   │   └── useFileAccess.ts         # 檔案存取 hook
│   │
│   └── types/
│       ├── tesla.ts                 # Tesla 相關類型
│       ├── video.ts                 # 影片相關類型
│       └── api.ts                   # API 相關類型
│
├── public/
│   ├── icons/
│   ├── manifest.json                # PWA manifest
│   └── sw.js                        # Service Worker
│
├── tests/
│   ├── unit/
│   │   ├── parser.test.ts
│   │   ├── sync-engine.test.ts
│   │   └── camera-config.test.ts
│   ├── integration/
│   │   ├── video-playback.test.ts
│   │   └── file-import.test.ts
│   └── e2e/
│       ├── viewer-flow.test.ts
│       └── export-flow.test.ts
│
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.mjs
└── .env.example
```

#### 2.5.3 核心資料類型

```typescript
// src/types/tesla.ts

/** Tesla 鏡頭位置（對應 Camzy 命名） */
type CameraPosition =
  | 'front'          // 前 — 前方主鏡頭
  | 'back'           // 後 — 後方鏡頭
  | 'left_front'     // 左前 — B柱左側鏡頭 (對應檔名 left_repeater)
  | 'right_front'    // 右前 — B柱右側鏡頭 (對應檔名 right_repeater)
  | 'left_rear'      // 左後 — 翼子板左側鏡頭 (HW4 新增)
  | 'right_rear';    // 右後 — 翼子板右側鏡頭 (HW4 新增)

/** 鏡頭配置 */
interface CameraConfig {
  /** 4 鏡頭模式 (HW3 車型, 2020-2023) */
  FOUR_CAMERA: CameraPosition[];  // ['front', 'back', 'left_front', 'right_front']
  /** 6 鏡頭模式 (HW4 車型, 2024+) */
  SIX_CAMERA: CameraPosition[];   // 全部六個位置
}

/** 鏡頭位置與檔名映射 (TeslaCam 資料夾中的實際檔名) */
interface CameraFileMapping {
  front: 'front.mp4';
  back: 'back.mp4';
  left_front: 'left_repeater.mp4';   // 注意：檔名仍用 left_repeater
  right_front: 'right_repeater.mp4'; // 注意：檔名仍用 right_repeater
  left_rear: 'left_rear.mp4';        // HW4 新增
  right_rear: 'right_rear.mp4';      // HW4 新增
}

/** 行車數據 (Data Overlay 用) */
interface DrivingData {
  speed: number;              // km/h
  gear: 'P' | 'R' | 'N' | 'D';
  gpsLat: number;
  gpsLng: number;
  timestamp: Date;
  autopilotState: 'off' | 'manual' | 'autopilot' | 'fsd';
  brakePedal: number;         // 0-100%
  acceleratorPedal: number;   // 0-100%
}

/** 事件類型 */
type EventType = 'recent' | 'saved' | 'sentry';

/** Sentry 觸發類型 */
type SentryTrigger = 'motion' | 'impact' | 'glass_break' | 'proximity' | 'unknown';

/** 單一事件 */
interface TeslaCamEvent {
  id: string;                          // 唯一識別碼
  type: EventType;                     // 事件類型
  timestamp: Date;                     // 事件時間
  folderName: string;                  // 資料夾名稱 (YYYY-MM-DD_HH-MM-SS)
  cameras: Map<CameraPosition, VideoFile>; // 各鏡頭影片
  thumbnails?: Map<CameraPosition, string>; // 縮圖 (blob URL)
  duration: number;                    // 持續時間（秒）
  totalSize: number;                   // 總檔案大小（bytes）
  sentryTrigger?: SentryTrigger;       // Sentry 觸發類型
  gpsData?: GPSPoint[];                // GPS 軌跡
  metadata?: EventMetadata;            // 額外 metadata
}

/** 影片檔案 */
interface VideoFile {
  camera: CameraPosition;
  file: File;                          // File API 物件
  blobUrl?: string;                    // 用於播放的 blob URL
  resolution: { width: number; height: number };
  duration: number;
  size: number;
  hasAudio: boolean;
}

/** GPS 座標點 */
interface GPSPoint {
  lat: number;
  lng: number;
  timestamp: Date;
  speed?: number;                      // km/h
}

/** 播放器狀態 */
interface ViewerState {
  currentEvent: TeslaCamEvent | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  volume: number;
  isMuted: boolean;
  activeCameras: CameraPosition[];
  focusedCamera: CameraPosition | null; // 放大的鏡頭
  layoutMode: 'grid' | 'focus';
  cameraCount: 4 | 6;
}

/** 匯出設定 */
interface ExportConfig {
  startTime: number;
  endTime: number;
  cameras: CameraPosition[];
  layout: 'single' | 'grid-4' | 'grid-6';
  quality: '720p' | '1080p' | 'original';
  includeTimestamp: boolean;
  format: 'mp4';
}
```

---

## 3. 商業模式

### 3.1 定價策略

#### 3.1.1 免費基礎 + 按次付費模式（Pay-Per-Use）

> **核心理念**: 日常「看」影片完全免費，當事故發生需要「處理」時才收費。
> 這正是用戶最願意付費的時刻 — 事故當下，時間就是金錢，功能的價值最大化。

**免費功能 (Free Tier)**:

| 功能 | 說明 |
|------|------|
| 六鏡頭同步播放 | 4 鏡頭 + 6 鏡頭（HW4）完整支援 |
| 行車數據儀表板 | 播放時顯示車速/檔位/GPS/駕駛模式 |
| 事件瀏覽與分類 | 最近/保存/哨兵 分類，時間排序 |
| 地圖模式瀏覽 | 地圖群集紅點，點擊跳轉事件 |
| 時間軸控制 | 播放/暫停/快轉/倒轉/速度調整 |
| 基本截圖 | 擷取當前六鏡頭畫面為圖片 |
| 深色/淺色主題 | 切換主題 |
| 鍵盤快捷鍵 | 桌面版完整快捷鍵支援 |
| 鏡頭排列設定 | 左右排列偏好 |

**付費功能 — 按次計費 (事故處理場景)**:

| 付費功能 | 單次價格 | 說明 |
|----------|----------|------|
| **Data Overlay 匯出** | NT$75 / 次 | 匯出含行車數據浮水印的證據等級影片（時速、GPS、檔位、AP狀態、踏板紀錄） |
| **AI 車牌辨識** | NT$30 / 次 | 自動偵測並複製影片中所有車牌號碼 |
| **事故報告生成** | NT$99 / 次 | AI 分析事故影片，生成含截圖、時間線、描述的完整報告（PDF） |
| **影片分享連結** | NT$49 / 次 | 上傳影片到雲端，生成可分享的連結（30天有效） |
| **多鏡頭合併匯出** | NT$49 / 次 | 將多鏡頭合併為單一影片匯出（四宮格/六宮格佈局） |

**組合包（事故處理包）**:

| 方案 | 價格 | 內容 | 折扣 |
|------|------|------|------|
| **基本事故包** | NT$129 | Data Overlay + 車牌辨識 + 分享連結（各 1 次） | 省 NT$25 |
| **完整事故包** | NT$199 | Data Overlay + 車牌辨識 + 事故報告 + 分享連結 + 合併匯出（各 1 次） | 省 NT$103 |
| **年度安心方案** | NT$599/年 | 上述所有功能無限次使用 | 適合職業駕駛/車隊 |

#### 3.1.2 定價依據

- **按次付費的心理優勢**: 事故發生當下用戶最願意付費，NT$75-199 的價位相比保險免賠額（通常 NT$3,000-10,000）微不足道
- **Camzy Pro 參考**: 終身方案約幾百元台幣 → 我們的按次付費單次更低，但累計可能更高
- **轉換觸發點**: 事故 → 需要證據 → 願意付費。非事故期間用免費功能保持黏著度
- **組合包策略**: 事故處理通常需要多個功能配合，組合包提供明確折扣誘因
- **年度方案**: 給高頻用戶（計程車司機、外送員、車隊）長期選項

### 3.2 金流串接（綠界 ECPay + LINE Pay）

> 僅串接台灣本地金流，降低開發複雜度。未來若拓展國際市場再加入 Stripe。

#### 3.2.1 綠界 ECPay（主要金流）

```yaml
ecpay:
  使用場景: 信用卡、超商代碼、ATM 轉帳、Google Pay
  整合方式: ECPay 全方位金流 AIO API
  手續費: 2.75%（信用卡）/ NT$15-25（超商/ATM 每筆）
  優勢:
    - 台灣最主流金流，支援超商付款（便利商店習慣）
    - 按次付費場景下，超商代碼讓無信用卡用戶也能付款
    - 電子發票 API 整合（B2C 雲端發票）
  實作重點:
    - 申請 ECPay 特約商店
    - 使用 AIO (All-In-One) 付款 API
    - 單次付款為主（不需訂閱扣款邏輯）
    - 年度方案: 使用 ECPay 定期定額功能
    - 處理回調 (ReturnURL / OrderResultURL)
    - 整合電子發票 API（開立雲端發票）
  按次付費流程:
    1. 用戶點擊付費功能（如「Data Overlay 匯出」）
    2. 前端顯示付費確認彈窗（NT$75，選擇付款方式）
    3. 建立 ECPay 訂單 → 導向付款頁
    4. 付款完成 → 回調觸發 → 解鎖該次功能使用權
    5. 開立電子發票
```

#### 3.2.2 LINE Pay（行動支付）

```yaml
line_pay:
  使用場景: 手機用戶快速付款（台灣 LINE 覆蓋率 > 90%）
  整合方式: LINE Pay Online API v3
  手續費: 3.0%
  優勢:
    - 一鍵付款體驗佳，適合小額按次付費場景
    - NT$30-199 的價位非常適合 LINE Pay 快速結帳
  實作重點:
    - Request API 建立付款請求
    - Confirm API 確認付款
    - 支援 LINE Pay 積點折抵
    - 付款完成後同步解鎖功能
```

#### 3.2.3 金流架構

```
用戶觸發付費功能
    │
    ▼
付費確認彈窗
    │
    ├── [信用卡/ATM/超商] ──► ECPay AIO
    └── [LINE Pay]          ──► LINE Pay API v3
    │
    ▼
Payment Service Layer (統一介面)
    │
    ├── ECPayProvider    (信用卡/超商/ATM)
    └── LinePayProvider  (LINE Pay)
    │
    ▼
Webhook / Callback Handler
    │
    ▼
Transaction Service (單次交易記錄)
    │
    ├── 解鎖功能使用權 (寫入 user_transactions)
    └── 開立電子發票 (ECPay 發票 API)
    │
    ▼
Database
    ├── user_transactions  (交易紀錄: user_id, feature, amount, status, created_at)
    ├── user_credits       (用戶餘額/組合包剩餘次數)
    └── invoices           (發票紀錄)
```

### 3.3 營收預估

```
假設:
- 第一年註冊用戶: 5,000 (台灣 Tesla 車主 ≈ 50,000，獲取 10%)
- 台灣年交通事故率: 每車約 5-10% / 年發生需要影片舉證的事故
- 哨兵模式事件觸發率: 每車每月 10-50 次，其中需要深入處理約 1-3 次

付費轉換估算:
- 5,000 用戶中，每年約 500 人 (10%) 遇到需要付費處理的場景
- 平均每次事故使用 1.5 個付費功能
- 平均每次付費金額: NT$120（單次 vs 組合包混合）

按次付費月營收:
- 事故相關: 500 人 × 1.5 次/年 × NT$120 / 12 月 = NT$7,500/月
- 年度安心方案: 50 人 × NT$599/年 / 12 月 = NT$2,496/月
- 日常付費（分享連結等）: ~NT$3,000/月
- 月營收合計: ~NT$13,000/月

年營收: ~NT$156,000（第一年，保守估計）

成長預期:
- 第二年: 用戶 15,000 → 年營收 ~NT$470,000
- 第三年: 用戶 30,000 + 口碑效應 → 年營收 ~NT$1,200,000

主要成本:
- 雲端基礎設施 (Vercel): ~NT$3,000/月（初期流量低）
- CDN 與儲存 (R2): ~NT$2,000/月（按用量計費）
- 金流手續費: ~3% = ~NT$390/月
- AI API 費用 (車牌辨識/事故分析): ~NT$5,000/月
- 總月成本: ~NT$10,390/月

損益平衡點: 約 3,000 活躍用戶時可達損益平衡
```

---

## 4. 補充事項與風險評估

### 4.1 法律合規

1. **隱私權**: 行車記錄器影片可能包含他人車牌、人臉
   - 需要隱私政策頁面
   - 分享功能需提醒用戶遵守個資法
   - 考慮自動模糊車牌/人臉功能（P2）
   - 台灣《個人資料保護法》合規

2. **GDPR / 個資法**: 如果處理歐盟用戶資料
   - 資料處理同意書
   - 資料刪除權實作
   - Cookie 同意機制

3. **Tesla 商標**: 產品名稱與行銷不能暗示與 Tesla 官方關聯
   - 加入免責聲明：「本產品非 Tesla 官方產品」

### 4.2 技術風險

| 風險 | 可能性 | 影響 | 緩解策略 |
|------|--------|------|----------|
| Tesla 更改檔案格式 | 中 | 高 | 模組化 parser，易於更新；監控 Tesla 更新日誌 |
| 瀏覽器 API 相容性 | 低 | 中 | File System Access API 有降級方案；定期測試主流瀏覽器 |
| 大檔案效能問題 | 高 | 中 | 漸進式載入、Web Worker、虛擬捲動 |
| FFmpeg.wasm 效能 | 高 | 中 | 提供伺服器端合併選項、限制匯出長度 |
| H.265 瀏覽器不支援 | 中 | 高 | 偵測 codec 支援度、提供伺服器端轉碼 |
| 六鏡頭規格變更 | 中 | 高 | 動態鏡頭配置、不寫死鏡頭數量 |

### 4.3 SEO 與行銷策略

1. **SEO 關鍵字目標**:
   - "Tesla dashcam viewer" / "Tesla 行車記錄器播放器"
   - "Tesla Sentry Mode viewer" / "Tesla 哨兵模式"
   - "TeslaCam viewer online" / "Tesla 行車記錄器線上看"
   - "Tesla 六鏡頭 行車記錄器"

2. **內容行銷**:
   - 部落格：Tesla 行車記錄器使用教學
   - YouTube：產品示範影片
   - 社群：PTT / Mobile01 / Facebook Tesla 車主群

3. **推薦計畫**:
   - 邀請碼：邀請一位用戶，雙方各得一個月 Pro 免費

### 4.4 競爭壁壘

1. **先發優勢**: 第一個支援六鏡頭的 Web 播放器
2. **在地化**: 深度繁中支持，台灣金流整合
3. **Web 免安裝**: 降低使用門檻，SEO 可觸及
4. **AI 功能**: 事件智慧分析為技術壁壘
5. **網路效應**: 分享連結功能創造用戶回流

### 4.5 上線路線圖（2026-03-12 更新）

```
Phase 0 ✅ 已完成：MVP 核心功能
├── ✅ 核心播放器（4+6 鏡頭同步）
├── ✅ 檔案匯入（File System Access API + 拖放）
├── ✅ 事件列表（Recent / Saved / Sentry）
├── ✅ 影片匯出（硬體加速，含時間浮水印）
├── ✅ 響應式 UI（深色主題）
└── ✅ 鍵盤快捷鍵

Phase 1 🔜 進行中：外網上線
├── 品牌更名：DashView → TesVault
├── 購入 tesvault.app 網域
├── GitHub repo 建立（公開或私有）
├── Vercel 部署（push-to-deploy）
├── 自訂網域設定（tesvault.app → Vercel）
├── SSL 憑證（Vercel 自動處理）
├── Landing Page（首頁介紹 + 立即使用）
└── 基本 SEO（meta tags、og:image、sitemap）

Phase 2 ⏳ 商業化 — SEO 優化
├── Google Search Console 設定
├── 關鍵字策略（Tesla dashcam viewer、TeslaCam player 等）
├── 結構化資料（Schema.org）
├── 廣告評估（Google AdSense 申請）
└── 多語系基礎（英文為主，繁中為輔）

Phase 3 ⏳ 商業化 — 付費功能
├── 用戶帳號系統（Supabase Auth）
├── ECPay 綠界金流串接（信用卡/超商/ATM）
├── LINE Pay 串接
├── 付費功能解鎖機制（按次付費）
└── 電子發票（ECPay 發票 API）

Phase 4 ⏳ 進階功能
├── GPS 地圖同步播放（Leaflet + event.json）
├── 行車數據儀表板（event.json 整合）
├── 事故報告生成（AI PDF）
├── 影片分享連結（雲端上傳）
└── PWA 離線支援
```

### 4.6 月費成本估算

**Phase 1 上線後（純前端，無後端）**

| 項目 | 費用/月 | 說明 |
|------|---------|------|
| Vercel Pro | $20（約 NT$650）| 商業用途必須 Pro 方案 |
| tesvault.app 網域 | ~NT$40 | 約 NT$480/年（.app 需 HTTPS）|
| FFmpeg / 地圖 CDN | 免費 | jsdelivr + OpenStreetMap |
| **合計** | **~NT$700/月** | 零用戶也是這個成本 |

**Phase 3 後（加入後端）**

| 新增項目 | 費用/月 | 觸發時機 |
|----------|---------|----------|
| Supabase（資料庫 + Auth）| $25 | 加入用戶帳號時 |
| Cloudflare R2（影片分享儲存）| 依用量，極低 | 做影片分享功能時 |
| ECPay 手續費 | 2.75%（信用卡）| 有收入才有成本 |
| **合計** | **~NT$1,500/月** | 有收入時才到這個階段 |

---

## 5. 測試用例

> 以下測試用例設計為可由 Claude Code 自動執行，使用 Vitest + Playwright 測試框架。

### 5.1 單元測試 (Unit Tests)

```typescript
// tests/unit/parser.test.ts
// TeslaCam 資料夾解析器測試

import { describe, it, expect } from 'vitest';
import { parseTeslaCamFolder, detectCameraConfig } from '@/lib/tesla/parser';

describe('TeslaCam Folder Parser', () => {

  describe('parseTeslaCamFolder', () => {

    it('TC-U001: 應正確解析標準 4 鏡頭 TeslaCam 資料夾結構', () => {
      // Given: 模擬 4 鏡頭 TeslaCam 資料夾
      const mockFiles = [
        'TeslaCam/RecentClips/2025-01-15_10-30-00/front.mp4',
        'TeslaCam/RecentClips/2025-01-15_10-30-00/left_repeater.mp4',
        'TeslaCam/RecentClips/2025-01-15_10-30-00/right_repeater.mp4',
        'TeslaCam/RecentClips/2025-01-15_10-30-00/back.mp4',
      ];

      // When: 解析資料夾
      const result = parseTeslaCamFolder(mockFiles);

      // Then: 應返回正確的事件結構
      expect(result.events).toHaveLength(1);
      expect(result.events[0].type).toBe('recent');
      expect(result.events[0].cameras.size).toBe(4);
      expect(result.events[0].timestamp).toEqual(new Date('2025-01-15T10:30:00'));
    });

    it('TC-U002: 應正確解析 6 鏡頭 TeslaCam 資料夾結構 (HW4)', () => {
      const mockFiles = [
        'TeslaCam/SavedClips/2025-06-01_14-00-00/front.mp4',
        'TeslaCam/SavedClips/2025-06-01_14-00-00/back.mp4',
        'TeslaCam/SavedClips/2025-06-01_14-00-00/left_repeater.mp4',
        'TeslaCam/SavedClips/2025-06-01_14-00-00/right_repeater.mp4',
        'TeslaCam/SavedClips/2025-06-01_14-00-00/left_rear.mp4',
        'TeslaCam/SavedClips/2025-06-01_14-00-00/right_rear.mp4',
      ];

      const result = parseTeslaCamFolder(mockFiles);

      expect(result.events).toHaveLength(1);
      expect(result.events[0].cameras.size).toBe(6);
      expect(result.cameraConfig).toBe('SIX_CAMERA');
    });

    it('TC-U003: 應正確分類 RecentClips / SavedClips / SentryClips', () => {
      const mockFiles = [
        'TeslaCam/RecentClips/2025-01-15_10-00-00/front.mp4',
        'TeslaCam/SavedClips/2025-01-15_11-00-00/front.mp4',
        'TeslaCam/SentryClips/2025-01-15_12-00-00/front.mp4',
      ];

      const result = parseTeslaCamFolder(mockFiles);

      const types = result.events.map(e => e.type);
      expect(types).toContain('recent');
      expect(types).toContain('saved');
      expect(types).toContain('sentry');
    });

    it('TC-U004: 應處理空資料夾', () => {
      const result = parseTeslaCamFolder([]);
      expect(result.events).toHaveLength(0);
      expect(result.error).toBeUndefined();
    });

    it('TC-U005: 非 TeslaCam 資料夾應返回錯誤', () => {
      const mockFiles = ['Documents/resume.pdf', 'Photos/vacation.jpg'];
      const result = parseTeslaCamFolder(mockFiles);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('INVALID_FOLDER_STRUCTURE');
    });

    it('TC-U006: 應處理缺少部分鏡頭檔案的情況', () => {
      const mockFiles = [
        'TeslaCam/RecentClips/2025-01-15_10-30-00/front.mp4',
        'TeslaCam/RecentClips/2025-01-15_10-30-00/left_repeater.mp4',
        // 缺少 right_repeater 和 back
      ];

      const result = parseTeslaCamFolder(mockFiles);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].cameras.size).toBe(2);
      // 不應報錯，只是標記為不完整
      expect(result.events[0].isComplete).toBe(false);
    });

    it('TC-U007: 應正確解析多個事件並按時間排序', () => {
      const mockFiles = [
        'TeslaCam/RecentClips/2025-01-15_10-00-00/front.mp4',
        'TeslaCam/RecentClips/2025-01-15_08-00-00/front.mp4',
        'TeslaCam/RecentClips/2025-01-15_12-00-00/front.mp4',
      ];

      const result = parseTeslaCamFolder(mockFiles);
      expect(result.events).toHaveLength(3);
      // 預設新到舊排序
      expect(result.events[0].timestamp.getHours()).toBe(12);
      expect(result.events[2].timestamp.getHours()).toBe(8);
    });
  });

  describe('detectCameraConfig', () => {

    it('TC-U008: 偵測 4 鏡頭配置 (HW3)', () => {
      const cameras = ['front', 'back', 'left_repeater', 'right_repeater'];
      expect(detectCameraConfig(cameras)).toBe('FOUR_CAMERA');
    });

    it('TC-U009: 偵測 6 鏡頭配置 (HW4)', () => {
      const cameras = ['front', 'back', 'left_repeater', 'right_repeater', 'left_rear', 'right_rear'];
      expect(detectCameraConfig(cameras)).toBe('SIX_CAMERA');
    });

    it('TC-U010: 未知配置應返回 UNKNOWN', () => {
      const cameras = ['front', 'unknown_cam'];
      expect(detectCameraConfig(cameras)).toBe('UNKNOWN');
    });
  });
});
```

```typescript
// tests/unit/sync-engine.test.ts
// 多影片同步引擎測試

import { describe, it, expect, vi } from 'vitest';
import { SyncEngine } from '@/lib/video/sync-engine';

describe('Video Sync Engine', () => {

  it('TC-U011: 應同步所有影片的播放狀態 (play)', () => {
    const mockVideos = createMockVideoElements(4);
    const engine = new SyncEngine(mockVideos);

    engine.play();

    mockVideos.forEach(video => {
      expect(video.play).toHaveBeenCalled();
    });
  });

  it('TC-U012: 應同步所有影片的暫停狀態', () => {
    const mockVideos = createMockVideoElements(4);
    const engine = new SyncEngine(mockVideos);

    engine.pause();

    mockVideos.forEach(video => {
      expect(video.pause).toHaveBeenCalled();
    });
  });

  it('TC-U013: seek 時所有影片應跳轉到相同時間', () => {
    const mockVideos = createMockVideoElements(4);
    const engine = new SyncEngine(mockVideos);

    engine.seek(30.5);

    mockVideos.forEach(video => {
      expect(video.currentTime).toBe(30.5);
    });
  });

  it('TC-U014: 播放速度變更應套用到所有影片', () => {
    const mockVideos = createMockVideoElements(6);
    const engine = new SyncEngine(mockVideos);

    engine.setPlaybackRate(2.0);

    mockVideos.forEach(video => {
      expect(video.playbackRate).toBe(2.0);
    });
  });

  it('TC-U015: 影片間時間差超過 100ms 應自動校正', () => {
    const mockVideos = createMockVideoElements(4);
    // 模擬第二個影片時間偏差 200ms
    mockVideos[1].currentTime = 10.2;
    mockVideos[0].currentTime = 10.0;

    const engine = new SyncEngine(mockVideos);
    engine.checkSync();

    expect(mockVideos[1].currentTime).toBeCloseTo(10.0, 1);
  });

  it('TC-U016: 應支援 6 鏡頭同步', () => {
    const mockVideos = createMockVideoElements(6);
    const engine = new SyncEngine(mockVideos);

    expect(engine.videoCount).toBe(6);
    engine.play();
    expect(mockVideos.every(v => v.play.mock.calls.length > 0)).toBe(true);
  });

  it('TC-U017: 單一影片載入失敗不應阻斷其他影片播放', () => {
    const mockVideos = createMockVideoElements(4);
    mockVideos[2].play = vi.fn().mockRejectedValue(new Error('Load failed'));

    const engine = new SyncEngine(mockVideos);

    // 不應拋出錯誤
    expect(() => engine.play()).not.toThrow();
    expect(engine.getErrors()).toHaveLength(1);
    expect(engine.getErrors()[0].camera).toBe(2);
  });
});

// 輔助函數
function createMockVideoElements(count: number) {
  return Array.from({ length: count }, () => ({
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    currentTime: 0,
    playbackRate: 1,
    duration: 60,
    readyState: 4,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}
```

```typescript
// tests/unit/camera-config.test.ts
// 鏡頭配置測試

import { describe, it, expect } from 'vitest';
import { getCameraLayout, getCameraLabel } from '@/lib/tesla/camera-config';

describe('Camera Config', () => {

  it('TC-U018: 4 鏡頭應返回 2×2 佈局', () => {
    const layout = getCameraLayout('FOUR_CAMERA');
    expect(layout.rows).toBe(2);
    expect(layout.cols).toBe(2);
  });

  it('TC-U019: 6 鏡頭應返回 3×2 佈局', () => {
    const layout = getCameraLayout('SIX_CAMERA');
    expect(layout.rows).toBe(2);
    expect(layout.cols).toBe(3);
  });

  it('TC-U020: 鏡頭標籤應有中英文（對應 Camzy 命名）', () => {
    expect(getCameraLabel('front', 'zh-TW')).toBe('前');
    expect(getCameraLabel('front', 'en')).toBe('Front');
    expect(getCameraLabel('back', 'zh-TW')).toBe('後');
    expect(getCameraLabel('left_front', 'zh-TW')).toBe('左前');
    expect(getCameraLabel('right_front', 'zh-TW')).toBe('右前');
    expect(getCameraLabel('left_rear', 'zh-TW')).toBe('左後');
    expect(getCameraLabel('right_rear', 'zh-TW')).toBe('右後');
  });
});
```

### 5.2 整合測試 (Integration Tests)

```typescript
// tests/integration/video-playback.test.ts

import { describe, it, expect } from 'vitest';

describe('Video Playback Integration', () => {

  it('TC-I001: 載入 TeslaCam 資料夾後應顯示事件列表', async () => {
    // Given: 模擬 TeslaCam 資料夾結構
    // When: 呼叫 loadFolder()
    // Then: 事件列表應包含正確數量的事件
  });

  it('TC-I002: 選擇事件後應載入所有鏡頭影片並開始同步播放', async () => {
    // Given: 已載入事件列表
    // When: 選擇第一個事件
    // Then: 所有鏡頭影片 element 應設置 src
    // Then: 所有影片 readyState 應 >= HAVE_METADATA
  });

  it('TC-I003: 匯出功能應生成有效的 MP4 檔案', async () => {
    // Given: 正在播放影片
    // When: 執行匯出 (startTime=0, endTime=10, cameras=['front'])
    // Then: 應返回有效的 Blob (type=video/mp4)
    // Then: Blob size > 0
  });

  it('TC-I004: File System Access API 降級到 input[webkitdirectory] 應正常運作', async () => {
    // Given: 瀏覽器不支援 showDirectoryPicker
    // When: 觸發檔案選擇
    // Then: 應使用 <input webkitdirectory> 作為替代
  });

  it('TC-I005: 切換事件時應正確清理前一個事件的資源', async () => {
    // Given: 正在播放事件 A
    // When: 切換到事件 B
    // Then: 事件 A 的 blob URLs 應被 revoke
    // Then: 記憶體使用不應持續增長
  });
});
```

### 5.3 端到端測試 (E2E Tests)

```typescript
// tests/e2e/viewer-flow.test.ts
// 使用 Playwright

import { test, expect } from '@playwright/test';

test.describe('Viewer Core Flow', () => {

  test('TC-E001: 首頁應顯示歡迎畫面與檔案匯入區域', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('選擇資料夾')).toBeVisible();
    await expect(page.locator('[data-testid="drop-zone"]')).toBeVisible();
  });

  test('TC-E002: 拖放資料夾後應進入播放器界面', async ({ page }) => {
    await page.goto('/viewer');
    // 模擬檔案拖放
    // 驗證播放器 UI 元素出現
    await expect(page.locator('[data-testid="video-grid"]')).toBeVisible();
    await expect(page.locator('[data-testid="event-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="timeline"]')).toBeVisible();
  });

  test('TC-E003: 點擊鏡頭應切換到全螢幕模式', async ({ page }) => {
    // Given: 播放器已載入影片
    await page.goto('/viewer');
    // When: 點擊前方鏡頭
    await page.locator('[data-testid="camera-front"]').click();
    // Then: 應進入 focus 模式
    await expect(page.locator('[data-testid="video-grid"]')).toHaveAttribute('data-layout', 'focus');
  });

  test('TC-E004: 鍵盤快捷鍵應正常運作', async ({ page }) => {
    await page.goto('/viewer');

    // Space 暫停/播放
    await page.keyboard.press('Space');
    await expect(page.locator('[data-testid="play-button"]')).toHaveAttribute('data-state', 'paused');

    // 右方向鍵快進 5 秒
    await page.keyboard.press('ArrowRight');
    // 驗證時間軸前進

    // 調整播放速度
    await page.keyboard.press('>');
    await expect(page.locator('[data-testid="speed-display"]')).toHaveText('1.5x');
  });

  test('TC-E005: 響應式佈局 - 手機版應顯示單鏡頭模式', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone 尺寸
    await page.goto('/viewer');
    await expect(page.locator('[data-testid="video-grid"]')).toHaveAttribute('data-layout', 'mobile');
  });

  test('TC-E006: 響應式佈局 - 桌面版應顯示多宮格', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/viewer');
    await expect(page.locator('[data-testid="video-grid"]')).toHaveAttribute('data-layout', 'grid');
  });

  test('TC-E007: 深色/淺色主題切換', async ({ page }) => {
    await page.goto('/');
    // 預設深色
    await expect(page.locator('html')).toHaveClass(/dark/);
    // 切換淺色
    await page.locator('[data-testid="theme-toggle"]').click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });
});

test.describe('Sentry Event Flow', () => {

  test('TC-E008: Sentry 事件列表應顯示事件縮圖與類型標籤', async ({ page }) => {
    await page.goto('/viewer');
    // 切換到 Sentry 分類
    await page.locator('[data-testid="tab-sentry"]').click();
    // 驗證事件卡片
    const eventCard = page.locator('[data-testid="event-card"]').first();
    await expect(eventCard.locator('[data-testid="event-thumbnail"]')).toBeVisible();
    await expect(eventCard.locator('[data-testid="event-type-badge"]')).toBeVisible();
  });

  test('TC-E009: 點擊 Sentry 事件應播放事件前後影片', async ({ page }) => {
    await page.goto('/viewer');
    await page.locator('[data-testid="tab-sentry"]').click();
    await page.locator('[data-testid="event-card"]').first().click();

    // 影片應自動播放
    await expect(page.locator('[data-testid="video-grid"]')).toBeVisible();
  });
});

test.describe('Export Flow', () => {

  test('TC-E010: 匯出對話框應包含所有必要選項', async ({ page }) => {
    await page.goto('/viewer');
    await page.locator('[data-testid="export-button"]').click();

    const dialog = page.locator('[data-testid="export-dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-testid="time-range-selector"]')).toBeVisible();
    await expect(dialog.locator('[data-testid="camera-selector"]')).toBeVisible();
    await expect(dialog.locator('[data-testid="quality-selector"]')).toBeVisible();
    await expect(dialog.locator('[data-testid="export-confirm"]')).toBeVisible();
  });
});
```

### 5.4 效能測試

```typescript
// tests/performance/playback-perf.test.ts

import { describe, it, expect } from 'vitest';

describe('Performance Benchmarks', () => {

  it('TC-P001: 資料夾掃描 1000 個事件應在 3 秒內完成', async () => {
    const mockFiles = generateMockFiles(1000); // 模擬 1000 個事件

    const start = performance.now();
    const result = await parseTeslaCamFolder(mockFiles);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(3000);
    expect(result.events).toHaveLength(1000);
  });

  it('TC-P002: 4 鏡頭同步播放啟動應在 2 秒內完成', async () => {
    // 測量從選擇事件到所有影片開始播放的時間
    const start = performance.now();
    // ... 載入並播放 4 個影片
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(2000);
  });

  it('TC-P003: 6 鏡頭同步播放啟動應在 3 秒內完成', async () => {
    const start = performance.now();
    // ... 載入並播放 6 個影片
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(3000);
  });

  it('TC-P004: 記憶體使用在切換 10 個事件後不應超過 500MB', async () => {
    // 連續切換 10 個事件
    // 檢查 performance.memory.usedJSHeapSize
    // 確認記憶體沒有洩漏
  });

  it('TC-P005: 事件列表虛擬捲動在 5000 個事件時應維持 60fps', async () => {
    // 載入 5000 個事件
    // 快速捲動事件列表
    // 測量 FPS 不低於 60
  });
});
```

### 5.5 瀏覽器相容性測試

```typescript
// tests/compatibility/browser.test.ts

describe('Browser Compatibility', () => {

  const browsers = ['chromium', 'firefox', 'webkit'] as const;

  browsers.forEach(browser => {

    it(`TC-B001-${browser}: H.264 MP4 應可在 ${browser} 播放`, async () => {
      // 測試 H.264 MP4 播放
    });

    it(`TC-B002-${browser}: File System Access API 或降級方案應在 ${browser} 可用`, async () => {
      // 測試檔案選擇功能
    });

    it(`TC-B003-${browser}: 多影片同步播放應在 ${browser} 正常運作`, async () => {
      // 測試 4/6 鏡頭同步
    });
  });
});
```

### 5.6 無障礙測試

```typescript
// tests/accessibility/a11y.test.ts

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility', () => {

  test('TC-A001: 首頁應通過 axe 無障礙檢測', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toHaveLength(0);
  });

  test('TC-A002: 播放器應可完全透過鍵盤操作', async ({ page }) => {
    await page.goto('/viewer');

    // Tab 導航應能到達所有互動元素
    await page.keyboard.press('Tab');
    // 確認 focus 可見
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeDefined();
  });

  test('TC-A003: 影片控制應有 ARIA 標籤', async ({ page }) => {
    await page.goto('/viewer');
    await expect(page.locator('[data-testid="play-button"]')).toHaveAttribute('aria-label');
    await expect(page.locator('[data-testid="timeline"]')).toHaveAttribute('role', 'slider');
  });
});
```

---

## 6. Claude Code 開發指引

### 6.1 開發順序建議

Claude Code 在進行 vibe coding 時，建議按以下順序實作：

```
Step 1: 專案初始化
  → npx create-next-app@latest dashview --typescript --tailwind --app
  → 安裝依賴: zustand, @ffmpeg/ffmpeg, mapbox-gl
  → 設定 ESLint, Prettier, Vitest, Playwright

Step 2: 核心資料層
  → 實作 src/types/tesla.ts (類型定義)
  → 實作 src/lib/tesla/parser.ts (資料夾解析)
  → 實作 src/lib/tesla/camera-config.ts (鏡頭配置)
  → 撰寫並通過 parser 單元測試

Step 3: 影片同步引擎
  → 實作 src/lib/video/sync-engine.ts
  → 實作 src/lib/video/playback.ts
  → 撰寫並通過同步引擎單元測試

Step 4: UI 組件
  → 實作 VideoPlayer → VideoGrid → Timeline → PlaybackControls
  → 實作 EventList → EventCard → FilterPanel
  → 實作 Sidebar → Header → 整體 Layout
  → 深色主題 CSS

Step 5: 頁面整合
  → Landing Page (/)
  → Viewer Page (/viewer)
  → 檔案拖放功能
  → 整合所有組件

Step 6: 進階功能
  → 影片匯出 (FFmpeg.wasm)
  → GPS 地圖
  → 分享功能
  → 付費功能 + 金流

Step 7: 測試與優化
  → 執行所有測試
  → 效能優化
  → 瀏覽器相容性測試
  → 部署到 Vercel
```

### 6.2 關鍵實作提示

```yaml
parser_implementation:
  - 使用 async generator 處理大量檔案掃描，避免阻塞 UI
  - 檔案路徑使用 '/' 統一分隔符
  - 時間戳解析格式: YYYY-MM-DD_HH-MM-SS

sync_engine_implementation:
  - 以 front 鏡頭為 master clock
  - 使用 requestAnimationFrame 而非 setInterval
  - 同步校正閾值: 100ms
  - 處理影片載入失敗的降級方案

ui_implementation:
  - 使用 CSS Grid 做鏡頭佈局，不要用 absolute positioning
  - 影片元素使用 object-fit: contain
  - 手機版使用 touch 事件做滑動切換
  - 時間軸使用 canvas 繪製以提高效能

performance_tips:
  - 使用 URL.createObjectURL 播放本地檔案
  - 切換事件時 URL.revokeObjectURL 釋放記憶體
  - 事件列表使用虛擬捲動 (react-virtual 或 @tanstack/virtual)
  - 縮圖使用 lazy loading
  - FFmpeg.wasm 在 Web Worker 中運行
```

### 6.3 環境變數範本

```env
# .env.example

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=DashView

# Map
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token

# Auth
NEXTAUTH_SECRET=your_secret
NEXTAUTH_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/dashview

# Storage (Cloudflare R2)
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_key
R2_SECRET_ACCESS_KEY=your_secret
R2_BUCKET_NAME=dashview-videos

# Payment - ECPay
ECPAY_MERCHANT_ID=your_merchant_id
ECPAY_HASH_KEY=your_hash_key
ECPAY_HASH_IV=your_hash_iv

# Payment - LINE Pay
LINEPAY_CHANNEL_ID=your_channel_id
LINEPAY_CHANNEL_SECRET=your_secret

# AI
ANTHROPIC_API_KEY=your_api_key

# Analytics
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key
```

---

## 附錄 A: Tesla 鏡頭對照表（參考 Camzy 命名）

| 檔名 | UI 顯示名稱 (中) | UI 顯示名稱 (英) | Camzy 標籤 | 位置說明 | 解析度 | 有音訊 | HW3 (4鏡頭) | HW4 (6鏡頭) |
|------|---------------|---------------|----------|---------|--------|--------|------------|------------|
| front.mp4 | 前 | Front | 前 | 前方主鏡頭 | 1920×960 | ✅ | ✅ | ✅ |
| back.mp4 | 後 | Back | 後 | 後方鏡頭 | 1280×960 | ❌ | ✅ | ✅ |
| left_repeater.mp4 | 左前 | Left Front | 左前 | B柱左側鏡頭 | 1280×960 | ❌ | ✅ | ✅ |
| right_repeater.mp4 | 右前 | Right Front | 右前 | B柱右側鏡頭 | 1280×960 | ❌ | ✅ | ✅ |
| left_rear.mp4 | 左後 | Left Rear | 左後 | 翼子板左側鏡頭 | 1280×960 | ❌ | ❌ | ✅ |
| right_rear.mp4 | 右後 | Right Rear | 右後 | 翼子板右側鏡頭 | 1280×960 | ❌ | ❌ | ✅ |

> **注意**: Camzy 的鏡頭排列設定支援「左|右」與「右|左」切換，我們也需實作此設定。

## 附錄 B: TeslaCam 資料夾結構

```
USB Drive (TESLADRIVE)/
└── TeslaCam/
    ├── RecentClips/              # 最近行車記錄（循環覆蓋）
    │   └── YYYY-MM-DD_HH-MM-SS/
    │       ├── front.mp4         # 前方主鏡頭
    │       ├── back.mp4          # 後方鏡頭
    │       ├── left_repeater.mp4 # 左前 (B柱左)
    │       ├── right_repeater.mp4# 右前 (B柱右)
    │       ├── left_rear.mp4     # 左後 (HW4 新增)
    │       └── right_rear.mp4    # 右後 (HW4 新增)
    │
    ├── SavedClips/               # 手動保存的片段（按喇叭觸發）
    │   └── YYYY-MM-DD_HH-MM-SS/
    │       └── (同上)
    │
    └── SentryClips/              # 哨兵模式事件
        └── YYYY-MM-DD_HH-MM-SS/
            ├── event.json        # 事件 metadata（觸發類型、時間、GPS 等）
            ├── front.mp4
            ├── back.mp4
            ├── left_repeater.mp4
            ├── right_repeater.mp4
            ├── left_rear.mp4     # HW4 新增
            ├── right_rear.mp4    # HW4 新增
            └── thumb.png         # 事件縮圖（部分車型）
```

## 附錄 C: Camzy 功能對照與我們的差異化策略

| Camzy 功能 | 我們是否實作 | 差異化策略 |
|-----------|-----------|---------|
| 4 鏡頭同步播放 (Free) | ✅ 免費 | 相同 |
| 6 鏡頭同步播放 (Pro) | ✅ **免費** | **我們免費提供，降低門檻** |
| 行車數據同步觀看 (Free) | ✅ 免費 | 相同 |
| 地圖模式瀏覽 (Free) | ✅ 免費 | 相同 |
| AI 車牌辨識 (Free) | ✅ **按次付費** | Camzy 免費但我們的辨識更準確（後端 AI） |
| 即時地圖同步播放 (Pro) | ✅ 免費 | **我們免費提供** |
| Data Overlay 匯出 (Pro) | ✅ 按次付費 | 相同定位為付費功能 |
| 精簡備份 (Pro) | ✅ 免費 | **我們免費提供** |
| 無限制批次操作 (Pro) | ✅ 免費 | **我們免費提供** |
| 影片分享連結 | ✅ 按次付費 | **Camzy 沒有此功能，我們獨有** |
| 事故報告生成 | ✅ 按次付費 | **Camzy 沒有此功能，我們獨有** |
| Web 免安裝 | ✅ | **Camzy 沒有，我們的核心差異** |

---

> **文件結束**
> 本企劃書設計為 Claude Code 可直接理解的格式，所有技術規格、類型定義、測試用例均可直接作為開發參考。
> 建議將此文件放在專案根目錄的 `docs/` 資料夾中，Claude Code 可隨時參考。

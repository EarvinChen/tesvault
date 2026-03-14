# TesVault 工作日誌

---

## 2026-03-12（週四）

**開發者**：Claude（PM + 測試經理 + 程式設計師三合一）
**今日重點**：多片段播放修復、時間軸全局 seek、匯出多片段、版本管理初始化

---

### 上午 — E2E 測試 & Bug 調查

完成四組匯出 E2E 瀏覽器測試：
- 保存 × 六宮格
- 保存 × 單鏡頭
- 最近 × 單鏡頭
- 哨兵 × 單鏡頭

用 ffprobe 驗證匯出的四支 MP4，確認格式（H.264）、幀率（30fps）、時長正確。

隨後調查「影片最多只有 1 分鐘」的 bug。

**根因**：
- `VideoGrid` 讀取的是 `currentEvent.cameras`（= 最後一個 clip）
- `handleEnded` 只呼叫 `pause()`，沒有切換 clip 的邏輯
- 整個多片段架構在 store 和 UI 層均未實作

---

### 下午 — 多片段播放重構（feat: initial MVP commit）

**四個檔案的架構改動**：

| 檔案 | 改動 |
|------|------|
| `viewer-store.ts` | 新增 `activeClipIndex`、`clipOffset`、`setActiveClip()` |
| `VideoGrid.tsx` | blobUrls 改從 `clips[activeClipIndex].cameras` 建立；`handleEnded` 自動推進 clip；`advancingClipRef` 控制自動播放 |
| `Timeline.tsx` | 顯示全域時間（`clipOffset + currentTime`）；估算總長 |
| `PlaybackControls.tsx` | 新增「◀ 片段 N/M ▶」UI；`handlePrevClip`/`handleNextClip` |

**測試基礎建設**：
因 ARM64 節點無法跑 vitest（rollup/esbuild native binary 缺失），改用自訂 Node.js test runner：
- `/tmp/test-runner-v2.js`：shim vitest API（describe/it/expect/vi.fn）
- 用 `tsc` 編譯 TypeScript 再執行
- 新增 8 個多片段測試（TC-MCP-001 ~ TC-MCP-008）
- 34/34 全部通過

---

### 下午 — Bug 修復 & 版本管理（fix commit）

**Git 初始化**：
- `git init`，`.gitignore` 加入 `/output/`
- 首次 commit：完整 MVP（commit f82aa6d）

**Bug 1 — Timeline 反向 seek 失效**：

舊的 `handleSeek` 把 global time 直接 clamp 到 `[0, duration]`，只能在當前 clip 內 seek，無法往前跨 clip。

修復方案：
- `viewer-store.ts` 新增 `clipDurations: number[]`、`setClipDuration()`、`seekGlobal(globalTime)`
- `seekGlobal` 遍歷 `clipDurations[]`，計算目標 clip + local time，必要時切換 `activeClipIndex`
- `VideoGrid.tsx` 在 `handleLoadedMetadata` 記錄實際 clip duration
- `Timeline.tsx` 改呼叫 `seekGlobal()` 而非 `seek()`

**Bug 2 — 匯出限制 1 分鐘**：

舊的匯出只接受當前 clip 的 blobUrls，最多 60 秒。

修復方案（軟性 3 分鐘限制）：
- `export.ts`：新增 `ClipSegment` 型別與 `ExportOptions.clipSegments`
- `exportWebCodecs.ts`：重構為 `recordSegment()` helper，MediaRecorder 持續錄製跨所有片段
- `ExportModal.tsx`：
  - 時間滑桿改用全域時間（跨所有 clip）
  - 起點變動時自動設定終點 = 起點 + 180s（3 分鐘軟性上限）
  - 超過 3 分鐘顯示黃色警告：「過長會影響輸出時間，會等待較久」
  - `buildClipSegments()` 動態從 `currentEvent.clips[i].cameras` 建立 blob URLs

**測試基礎建設提交**：
- `tests/runner.js` + `tsconfig.test.json` 納入 git
- `npm run test` = `tsc -p tsconfig.test.json && node tests/runner.js`
- 34/34 通過（commit a61743f）

---

### 晚上 — 列表片長 & Timeline 絲滑度（feat/fix commit）

**影片列表加入總片長**：
- `EventCard.tsx`：以 `clips.length × 60s` 估算總片長，顯示在事件類型 badge 旁
- 格式：`⏱ MM:SS`（例如 10 個片段 → `⏱ 10:00`）

**SavedClips Timeline 不絲滑 Bug 調查**：

以 ffprobe 分析真實 TeslaCam 資料：
- SentryClips：11 個 clip，間隔非常規律（每 60 秒），最後一段 27.616s
- SavedClips：11 個 clip，時間戳不規律（有 50 秒 gap、甚至 overlap），最後一段 27.641s

**根因**：Timeline.tsx 的 `estimatedTotal` 公式是：
```
clipOffset + duration + (totalClips - activeClipIndex - 1) × 60
```
當 clip 10（最後）載入，`duration` 從估算 60s 更新為實際 27.641s，`estimatedTotal` 從 ~660s 跳降至 ~628s，進度條突然往前跳 ~4.7 個百分點。

SentryClips/RecentClips 的 clips 幾乎都是整數 60s，所以跳幅很小，使用者不易察覺。

**修復**：改用 `clipDurations[]`（與 ExportModal 一致）：
```typescript
estimatedTotal = sum of (clipDurations[i] ?? 60) for all clips
```
每個 clip 載入時只更新自己那份，不影響全局計算（commit 5bdd0fc）

---

### 下班前 — 匯出 Bug 修復 & UX 改善

**Bug 3 — 匯出 Modal 崩潰（ReferenceError: clipLen is not defined）**：

在多片段重構過程中，按鈕 `disabled` 條件殘留舊變數名稱 `clipLen`。
瀏覽器 render 時拋出 ReferenceError，整個 Modal 直接崩潰，完全無法使用匯出功能。

修復：`ExportModal.tsx` 第 414 行
```diff
- disabled={clipLen <= 0 || availableCams.length === 0}
+ disabled={exportDuration <= 0 || availableCams.length === 0}
```
`exportDuration` 是已定義的變數（`= endTime - startTime`）。TypeScript strict mode 編譯通過（commit 9ff2791）。

**UX — 開始時間滑桿帶動結束時間**：

原本只有當 start >= end 時才更新結束時間（防呆邏輯），導致拖動開始時間時結束時間不動，使用者體驗差。

修改為拖動開始時間時**永遠**同步更新結束時間 = 開始 + 3 分鐘（clamped to total）：
```diff
- if (v >= endTime) setEndTime(Math.min(v + SOFT_LIMIT, estimatedTotal));
+ setEndTime(Math.min(v + SOFT_LIMIT, estimatedTotal));
```
效果：形成一個可滑動的「3 分鐘視窗」，結束滑桿仍可單獨微調（commit db678e1）。

---

### 今日 Commit 記錄

| Commit | 描述 |
|--------|------|
| `f82aa6d` | feat: initial TesVault MVP with multi-clip navigation |
| `a61743f` | fix: multi-clip timeline seek + multi-clip export with 3-min soft limit |
| `5bdd0fc` | feat/fix: event list duration + Timeline stable estimatedTotal |
| `4733472` | docs: add work log for 2026-03-11~12 |
| `9ff2791` | fix: resolve ReferenceError clipLen → exportDuration in ExportModal |
| `db678e1` | feat: start-time slider always drags end-time +3 min in ExportModal |

---

### 技術學習筆記

**ARM64 + vitest 無法使用**：
- 症狀：`@rollup/rollup-linux-arm64-gnu` 與 `@esbuild/linux-arm64` native binary 缺失
- 原因：node_modules 在 macOS(darwin) 安裝，掛載到 Linux VM，二進制不相容
- npm install 也被 403 Forbidden 封鎖（資安政策）
- 解法：自訂 Node.js test runner (`tests/runner.js`)，shim vitest API，用 `tsc` 編譯後執行

**SavedClips vs SentryClips 時間戳特性**：
- SentryClips：Tesla 哨兵模式，固定每 60s 存一段，相當規律
- SavedClips：手動存檔時 Tesla 把過去 ~10 分鐘都存下來，可能含 gap 或 overlap
- 最後一個 clip 幾乎一定比 60s 短（Tesla 在觸發點停止錄製）

**ClipDurations 懶載入策略**：
- 實際 clip duration 只有在瀏覽器 `loadedmetadata` 後才知道
- 在 store 維護 `clipDurations[]`，by `activeClipIndex` 填入
- 未測量的 clip 回退估算 60s
- `seekGlobal` 和 `estimatedTotal` 都使用同一份資料，保持一致

---

## 2026-03-11（週三）— 前日摘要

> *（由記憶重建，部分細節可能不完整）*

**主要工作**：
- 架設 Next.js + TypeScript 專案骨架（TesVault）
- 實作 TeslaCam 資料夾 parser（SavedClips / SentryClips / RecentClips）
- 實作 6 鏡頭同步播放引擎（VideoGrid + sync-engine）
- 實作 WebCodecs canvas 匯出（`exportWebCodecs.ts`）
- 寫 19 個 parser 單元測試 + 7 個 sync-engine 測試
- 完成匯出 UI（ExportModal）

**當日遺留問題**：
- 多片段播放（超過 1 分鐘）：隔天早上修復
- Timeline 反向 seek：隔天修復
- 匯出只能 1 分鐘：隔天修復（3 分鐘軟限制）

---

*最後更新：2026-03-12 18:30 CST*

---

## 2026-03-14（週六）

**開發者**：Claude（PM + 測試經理 + 程式設計師三合一）
**今日重點**：上線 Vercel、iOS 相容性修復

---

### 上午 — 上線準備

**技術棧確認**：
- GitHub Pages 排除（需 Node.js 伺服器，靜態匯出有限制）
- 選定 **Vercel**（Next.js 官方平台，零設定，push 自動部署）

**工具鏈建立（使用者操作）**：
1. 安裝 Homebrew（`/opt/homebrew`，ARM64 Apple Silicon）
2. 安裝 `gh` CLI（GitHub 官方命令列工具）
3. `gh auth login`（瀏覽器 OAuth，免密碼）
4. `gh repo create tesvault --public --source=. --remote=origin --push`（一行建 repo + push）
5. Vercel 連接 GitHub repo，自動偵測 Next.js，部署成功

**Vercel MCP**：已連線（`team_I4dmO20RbNiV9OvZedpOi47N`），後續可用 MCP 查看部署狀態。

---

### 下午 — iOS 相容性（三輪修復）

**問題發現**：部署上線後，iOS 無法選擇 TeslaCam 資料夾。

#### Bug 1 — iOS 完全不支援資料夾選取

iOS Safari 同時不支援：
- `window.showDirectoryPicker()`（File System Access API）
- `<input webkitdirectory>`（資料夾選取屬性，iOS 靜默忽略）

**修復方案**（commit `01458b2`）：
- 新增 `isIOS()` 偵測函式（含 iPad OS 13+ 偽裝 macOS 的判斷）
- iOS 改用 `<input multiple accept="video/mp4,video/*">`
- `processFiles()` 對 iOS 檔案自動加 `RecentClips/` 路徑前綴（`wrapWithFlatPath()`），讓 parser 無需修改即可正常分類
- Landing page 加藍色說明卡片（USB 轉接頭操作指引），按鈕文字改為「選擇影片檔案」

#### Bug 2 — iOS 點擊沒有反應（fileInputRef 斷開）

**根因**（同樣問題出現在 `page.tsx` 和 `Header.tsx`）：

`useFileAccess` Hook 內部維護自己的 `fileInputRef`，但 `page.tsx` 和 `Header.tsx` 各自用 `useRef(null)` 建立獨立的 ref 傳給 `FileInputFallback`。`openFolder()` 呼叫 Hook 內部的 ref `.click()`，而該 ref 從未掛載任何 DOM 元素，永遠是 null。

桌面不受影響的原因：`showDirectoryPicker` 成功，根本不走 ref 路徑。iOS 沒有 `showDirectoryPicker`，只能走 fallback，點了空氣。

**修復**（commit `73677c6`）：
- `UseFileAccessReturn` 新增 `fileInputRef` 和 `handleInputChange`
- `page.tsx` 改用 Hook 回傳的 ref，刪除自建的 `useRef`

#### Bug 3 — Header「選擇資料夾」按鈕在 iOS 仍失效

`Header.tsx` 有完全相同的 ref 斷開問題，額外還有：`handleInputChange` 選完檔案後呼叫的是 `openFolder()` 而非載入檔案，雙重 bug。

**修復**（commit `ba711f4`）：
- 同樣改用 Hook 回傳的 `fileInputRef` 和 `handleInputChange`
- iOS 按鈕標籤改為「選擇影片」
- 拖放事件在 iOS 停用（觸控裝置無意義）

---

### 今日 Commit 記錄

| Commit | 描述 |
|--------|------|
| `01458b2` | feat: iOS support for file selection |
| `73677c6` | fix: iOS tap does nothing — hook fileInputRef disconnected |
| `ba711f4` | fix: Header had same disconnected fileInputRef bug |

---

### 技術學習筆記

**iOS Safari 的資料夾存取限制**：
- `webkitdirectory`：屬性存在但靜默忽略，不會報錯，只是選檔視窗不顯示
- `showDirectoryPicker()`：完全未實作
- 唯一可行方案：`<input multiple>` 選多個個別檔案，再用 filename pattern 重建結構

**iPad OS 13+ 偽裝問題**：
- iPad OS 13 起 userAgent 改為 macOS 格式（避免被誤判為手機）
- 偵測方式：`navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1`

**React Hook ref 與 DOM 元素的連結問題**：
- `useRef` 只是一個可變物件（`{ current: null }`），必須透過 `ref={...}` 屬性實際掛載到 DOM 元素才有值
- Hook 回傳的 ref 若不在 return 值中暴露，使用方無法得知它的存在，各自建立新的 ref 就會造成斷開
- 教訓：包含 ref 的 Hook，應將 ref 納入 return type，確保使用方和 Hook 共用同一個實例

---

### 晚上 — iOS UX 全面優化（五項修復）

與使用者討論並確認四大問題後，一次合併上線（commit `2eb9f3b`）：

#### 1. Import 卡在 Landing Page（useEffect 取代 setTimeout）

原本：選完檔案後用 `setTimeout(500ms)` 等待 store 更新，在 iOS USB I/O 較慢時常超時，停留在首頁。

修復：改用 `useEffect` 監聽 `isLoading + events.length`，狀態就緒才自動導向 `/viewer`。同時新增 loading spinner 並停用按鈕防重複點擊。

#### 2. enrichEvents 並發限制（避免淹沒 iOS USB）

原本：`Promise.all(events.map(enrichOne))` 全部同時讀取，iOS USB 頻寬不足時會逾時或回傳空值。

修復：改為每批最多 4 個並發（`ENRICH_CONCURRENCY = 4`），依序處理所有事件，避免 I/O 擁塞。

#### 3. 安全區域 + 100dvh（iPhone 瀏海 / Home Bar 遮擋）

原先使用 `100vh`，在 iOS Safari 中瀏覽器 UI 會佔去一部分空間，導致 Timeline 被下方 Home Bar 遮擋。

修復：
- `layout.tsx`：`viewport.viewportFit = 'cover'`，`themeColor = '#1d6adf'`
- `globals.css`：新增 `.safe-top` / `.safe-bottom` utility（`env(safe-area-inset-*)`）
- Viewer page：`height: '100dvh'`（動態視口高度）
- Sidebar：`calc(100dvh - 3.5rem)`
- Timeline footer：`paddingBottom: max(0.5rem, env(safe-area-inset-bottom))`

#### 4. PWA 支援（加到主畫面）

新增 `public/manifest.json`、三組 icon（180 / 192 / 512px）以及 Apple meta tags，讓 iOS 使用者可將 TesVault 加到主畫面，以全螢幕模式執行（無瀏覽器 UI）。

#### 5. iOS 多鏡頭匯出警告

iOS 硬體 H.264 解碼器同時最多處理 2–4 路視訊，六鏡頭匯出時畫面會凍結。

修復：偵測 iOS + 非單鏡頭配置時，在匯出 Modal 頂端顯示橙色警告卡片，引導使用者切換為「單鏡頭」模式再匯出。

---

### 晚上（續）— ExportModal 按鈕被切掉（兩輪修復）

#### Round 1（commit `d3022d3`）

Overlay 未套用 safe-area 水平 padding，iOS 橫向 notch 時按鈕超出邊界。

修復：Overlay 加 `paddingLeft/Right: max(1rem, env(safe-area-inset-left/right))`，內層 Modal 移除 `mx-4`。

#### Round 2（commit `e5488af`）

Modal 無 `max-h` 限制，在小螢幕上 body 撐高後 footer 被 `overflow-hidden` 裁掉，按鈕消失。

修復：Modal 改為 `flex flex-col + max-h-[90dvh]`，header/footer 設 `shrink-0`，body 設 `overflow-y-auto flex-1`，footer 加 `paddingBottom: max(1.25rem, env(safe-area-inset-bottom))`。此為標準 Mobile Modal 排版模式。

#### 片段指示器文字縮短（commit `bd4050a`）

`PlaybackControls.tsx` 的「片段 N/M」在多鏡頭列佔用過多空間，改為「N/M」並縮小 `min-w`（56px → 32px）。

---

### 今日 Commit 記錄（補充）

| Commit | 描述 |
|--------|------|
| `2eb9f3b` | feat: iOS UX overhaul — import fix, enrichEvents throttle, safe-area, PWA, export warning |
| `d3022d3` | fix: ExportModal overlay safe-area horizontal padding |
| `e5488af` | fix: ExportModal footer clipped on iOS — flex col + max-h + shrink-0 footer |
| `bd4050a` | fix: shorten clip indicator '片段 x/x' → 'x/x' to save space on mobile |

---

### 技術學習筆記（補充）

**100dvh vs 100vh 在 iOS Safari**：
- `100vh`：等於整個視口高度（含瀏覽器工具列），內容可能被 UI 遮蓋
- `100dvh`（dynamic viewport height）：動態計算可視區域，瀏覽器 UI 展開/收起時即時更新，是 iOS 的正確解法

**Mobile Modal 黃金模式**：
```tsx
// Modal 容器: flex col + max-h
<div className="flex flex-col" style={{ maxHeight: '90dvh' }}>
  <div className="shrink-0"> {/* header：不縮放 */}
  <div className="overflow-y-auto flex-1"> {/* body：可捲動 */}
  <div className="shrink-0"> {/* footer：不縮放，永遠可見 */}
```
確保 footer 按鈕在任何螢幕高度都可操作。

**PWA 在 iOS 的限制**：
- `display: standalone` 搭配 `apple-mobile-web-app-capable` 才能全螢幕
- `status-bar-style: black-translucent` + `viewport-fit: cover` 可讓內容延伸到瀏海下方
- 需要 `apple-touch-icon`（180×180）才能在主畫面顯示正確圖示

*最後更新：2026-03-14 22:00 CST*

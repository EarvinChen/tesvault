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

# TesVault — Tesla 行車記錄器 Web Viewer

## 專案概述
這是一個基於 Web 的 Tesla 行車記錄器播放器，免安裝、支援最新六鏡頭 (HW4) 架構。
品牌名稱：**TesVault**（前身開發代號：DashView）｜網域目標：tesvault.app
完整產品企劃請參考 `docs/PRODUCT_PLAN.md`。

## 技術棧
- **Framework**: Next.js 14+ (App Router, TypeScript)
- **Styling**: Tailwind CSS
- **State**: Zustand
- **Video**: HTML5 Video API + custom sync engine
- **Testing**: Vitest (unit) + Playwright (e2e)
- **Video Processing**: FFmpeg.wasm (匯出用)
- **Map**: Leaflet + OpenStreetMap (免費，不需 API key)

## 開發規範
- 語言：TypeScript strict mode
- CSS：Tailwind utility classes only，不寫自訂 CSS 檔案
- 組件：React functional components + hooks
- 狀態：Zustand stores，不用 Context
- 預設深色主題 (dark mode first)
- 中文為主要語言（UI 文字）
- 所有程式碼註解使用英文

## 六鏡頭配置（重要）
Tesla HW4 實際 USB 檔案的命名格式：`{YYYY-MM-DD_HH-MM-SS}-{cameraSuffix}.mp4`

| USB 檔名後綴 (cameraSuffix) | 內部變數名 | UI中文 | UI英文 | 佈局位置 |
|------|--------|--------|--------|---------|
| front | front | 前 | Front | 頂部大畫面 |
| back | back | 後 | Back | 底部 |
| left_repeater | left_front | 左前 | Left Front | 中間左上 |
| right_repeater | right_front | 右前 | Right Front | 中間右上 |
| left_pillar | left_rear | 左後 | Left Rear | 中間左下 |
| right_pillar | right_rear | 右後 | Right Rear | 中間右下 |

HW3 舊車型只有 4 鏡頭：front, back, left_repeater, right_repeater（無 left_pillar / right_pillar）

## 六鏡頭佈局（手機版，參考 Camzy）
```
┌──────────────────┐
│     ● 前 (前方)    │  ← 主鏡頭，最大
├──────────────────┤
│ [D][24km/h][GPS]  │  ← 數據儀表板
├────────┬─────────┤
│ ● 左前  │  ● 右前  │
├────────┼─────────┤
│ ● 左後  │  ● 右後  │
├────────┴─────────┤
│     ● 後 (後方)    │
└──────────────────┘
```

## TeslaCam 實際資料夾結構（已驗證 HW4）
```
TeslaCam/
├── RecentClips/                          # 最近行車記錄（扁平結構！）
│   ├── YYYY-MM-DD_HH-MM-SS-front.mp4
│   ├── YYYY-MM-DD_HH-MM-SS-back.mp4
│   ├── YYYY-MM-DD_HH-MM-SS-left_repeater.mp4
│   ├── YYYY-MM-DD_HH-MM-SS-right_repeater.mp4
│   ├── YYYY-MM-DD_HH-MM-SS-left_pillar.mp4
│   └── YYYY-MM-DD_HH-MM-SS-right_pillar.mp4
├── SavedClips/                           # 手動保存（巢狀結構）
│   └── YYYY-MM-DD_HH-MM-SS/             # 儲存時間（事件 ID）
│       ├── YYYY-MM-DD_HH-MM-SS-front.mp4  # 各分鐘片段（可能多段）
│       ├── event.json                    # 事件 metadata（GPS、原因）
│       └── thumb.png                     # 縮圖
└── SentryClips/                          # 哨兵模式（巢狀，同 SavedClips）
    └── YYYY-MM-DD_HH-MM-SS/
        ├── YYYY-MM-DD_HH-MM-SS-front.mp4  # 每個事件約 11 段（66 個 mp4）
        ├── event.json
        └── thumb.png
```

**重要：** RecentClips 是扁平結構，SavedClips/SentryClips 是巢狀結構，每個事件資料夾內含多個 1 分鐘片段。
`TeslaCamEvent.clips` 存放所有片段，`cameras` 指向當前活躍片段（預設最後一段）。

## MVP 第一版功能範圍
1. 拖放/選擇 TeslaCam 資料夾匯入
2. 自動解析資料夾結構，分類事件
3. 事件列表（最近/保存/哨兵）
4. 4+6 鏡頭同步播放
5. 播放控制（播放/暫停/快轉/速度/音量）
6. 單鏡頭放大模式
7. 響應式佈局（桌面/手機）
8. 深色主題
9. 鍵盤快捷鍵

## 測試
```bash
npm run test          # Vitest 單元測試
npm run test:e2e      # Playwright e2e 測試
```
測試用例定義在 `docs/PRODUCT_PLAN.md` 第 5 章節。

## 指令
```bash
npm run dev           # 開發伺服器
npm run build         # 生產構建
npm run lint          # ESLint 檢查
```

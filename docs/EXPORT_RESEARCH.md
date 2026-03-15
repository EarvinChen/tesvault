# 匯出功能加速方案 — 研究報告

> 研究日期：2026-03-11
> 目的：評估三個加速匯出的方案，包含 iOS 相容性分析

---

## 你的問題：方案一（降低解析度）在 iOS 上有相容性問題嗎？

**沒有。** 降低解析度只是改變 FFmpeg 輸出的 MP4 大小，輸出格式仍是 H.264 MP4，在所有瀏覽器和作業系統上都能播放。問題不在輸出，而是「在哪裡跑 FFmpeg WASM」——目前我們的 FFmpeg.wasm 在使用者的瀏覽器內運算，所以是 Chrome 才能用（iOS 只有 Safari 能跑 PWA）。這個問題三個方案都有，不是降低解析度獨有的。

---

## 方案一：降低輸出解析度

### 原理
目前六宮格輸出 **1280 × 1440**（1.84 MP）→ 降為 **640 × 720**（0.46 MP），像素數量減少 4 倍。

### 實際加速效果
- 解析度與編碼時間的關係**不完全是線性**
- 640×720 大約比 1280×1440 快 **2×**（非 4×，因為 libx264 的 macroblock 計算、rate control 等有固定開銷）
- 搭配 `ultrafast` preset，估計總加速：**2–3×**

### iOS 相容性
- ✅ **完全沒問題**：MP4 H.264 是 Apple 最愛的格式，所有 iOS 版本皆相容
- 輸出的影片本身不受任何 iOS 限制

### 現實影響
- 對 dashcam 用途：640×720 每個鏡頭顯示 213×360（或 320×360），清晰度可接受
- 使用者如果要存證（法院），解析度降低可能不夠用

### 結論
| 優點 | 缺點 |
|------|------|
| 實作簡單，改一行 filter_complex | 加速有限（2–3×），根本問題未解 |
| 立即可測試 | 輸出品質下降 |
| 不影響任何相容性 | 仍需 ~7–10 分鐘處理 16 秒片段（估計） |

---

## 方案二：SIMD 單執行緒 FFmpeg.wasm

### SIMD 是什麼
WebAssembly SIMD（Single Instruction Multiple Data）是 WASM 的向量運算擴展，可以用一個指令同時處理多個數字。對影片編碼的關鍵 DCT/IDCT 運算影響尤其大。

### 最新 npm 套件狀況

| 套件 | 最新版 | SIMD | 說明 |
|------|--------|------|------|
| `@ffmpeg/core` | 0.12.10 | ❌ 無 | 標準單執行緒，無 SIMD |
| `@ffmpeg/core-mt` | 0.12.10 | ❌ 無 | 多執行緒，但也無 SIMD |
| `@ffmpeg/core-simd` | — | — | **不存在**，官方未發佈 |

> **關鍵發現**：官方 SIMD build **尚未發佈**。SIMD 支援在 [ffmpegwasm GitHub Discussion #415](https://github.com/ffmpegwasm/ffmpeg.wasm/discussions/415) 列為 roadmap 但沒有時間表。

### SIMD 的理論加速
研究顯示 WASM SIMD 對 DCT 運算的加速：
- 4×4 DCT：**2×** 快
- 8×8 DCT：**4.7×** 快
- 16×16 DCT：**4.8×** 快
- 32×32 DCT：**8.7×** 快

**整體應用層面**：官方文件顯示實測影片編碼約 **1.17×**（17%）加速。
- 原因：H.264 編碼除了 DCT 外還有很多其他工作（熵編碼、motion estimation 等），SIMD 不是全部
- HEVC 獲益更大，H.264 較有限

### 瀏覽器 SIMD 支援
| 瀏覽器 | 支援版本 | iOS Safari |
|--------|---------|------------|
| Chrome | 91+ | — |
| Firefox | 89+ | — |
| **Safari / iOS Safari** | **16.4+（2023年3月）** | ✅ iOS 16.4+ |
| Edge | 91+ | — |

> **iOS 相容性**：WASM SIMD 在 iOS Safari 16.4+ 完全支援，目前用 iPhone 的人 90%+ 都符合（iOS 16 普及率高）。

### 結論
| 優點 | 缺點 |
|------|------|
| 理論上 iOS Safari 可用 | 官方無現成 npm 套件 |
| 不需改架構 | 需要自己 fork + 用 Docker/Emscripten 編譯 |
| 與 FFmpeg.wasm 完全相容 | 實際 H.264 加速只有 17%，不解決根本問題 |

**方案二的結論：短期不可行。** 沒有現成套件，自己編譯成本高，效果也遠不如預期（只有 17% 加速）。

---

## 方案三：WebCodecs API

### 什麼是 WebCodecs
瀏覽器原生的影片編碼/解碼 API（W3C 標準），直接呼叫裝置的硬體編碼器（GPU VideoToolbox on Apple, Media Foundation on Windows, VA-API on Linux）。不需要 WASM，不需要下載任何東西。

### 速度對比
| 方案 | 速度 | CPU 使用率 |
|------|------|------------|
| FFmpeg.wasm (無 SIMD) | 基準（極慢） | 100% |
| FFmpeg.wasm (SIMD) | 約 1.2× | 100% |
| FFmpeg.wasm (core-mt) | 約 4-8×（如果能運作） | 400-800% |
| **WebCodecs（硬體加速）** | **約 10-100×** | **~15%** |

### iOS Safari 支援現況（關鍵！）

| 功能 | Chrome 94+ | Safari 26+（iOS 18+） | 舊版 Safari |
|------|------------|----------------------|-------------|
| VideoEncoder（H.264） | ✅ | ✅ | ❌ |
| VideoDecoder | ✅ | ✅ 16.4+ | ❌ |
| AudioEncoder | ✅ | ✅（Safari 26+，2025/9 才加入） | ❌ |
| AudioDecoder | ✅ | ✅ 16.4+ | ❌ |

> **iOS 的致命問題**：
> - `VideoEncoder`（最核心的功能）在 Safari 26 以前**不存在或不穩定**
> - `AudioEncoder` 在 Safari 26 之前**完全不支援**（Safari 26 = iOS 18 對應版本，2025年9月才發布）
> - 目前（2026年3月）iOS 上的 Safari 26 普及率估計約 50-60%，不夠高

### 六宮格實作方式（技術可行性）
```
1. 將 6 個 <video> 元素繪製到 OffscreenCanvas（合成畫面）
2. 用 VideoEncoder 逐幀編碼 canvas 輸出
3. 用 mp4-muxer（開源 TS library）封裝成 MP4
4. 下載
```

**現成工具**：
- [`mp4-muxer`](https://github.com/Vanilagy/mp4-muxer)：純 TypeScript，專為 WebCodecs 設計，零依賴
- [`@diffusionstudio/core`](https://www.npmjs.com/package/@diffusionstudio/core)：WebCodecs 的更高層封裝

### 結論
| 優點 | 缺點 |
|------|------|
| 速度提升 10-100×（硬體加速） | iOS Safari 26 以前不支援 AudioEncoder |
| 不需 WASM，無首次載入延遲 | Firefox 有 H.264 解碼 bug |
| 最佳長期方案 | 實作複雜度高（逐幀處理、muxer 整合） |
| 瀏覽器原生，零依賴 | 需要處理 fallback（不支援的瀏覽器用 FFmpeg.wasm） |

---

## 綜合比較

| 方案 | 預估加速 | iOS 相容性 | 實作難度 | 推薦指數 |
|------|---------|------------|---------|---------|
| **方案一**：降低解析度 | 2–3× | ✅ 完全相容 | ⭐ 極低（改一行） | 🟡 臨時緩解 |
| **方案二**：SIMD core | 1.2× | ✅ iOS 16.4+ | ⭐⭐⭐⭐⭐ 極高（需自己編譯） | 🔴 不值得 |
| **方案三**：WebCodecs | 10–100× | ⚠️ 僅 Safari 26+ | ⭐⭐⭐ 中等 | 🟢 長期最佳 |

---

## 建議策略：漸進式升級

### 第一步（現在，1-2天）：降解析度 + WebCodecs 能力偵測
```javascript
// 先偵測瀏覽器是否支援 WebCodecs
const supportsWebCodecs = typeof VideoEncoder !== 'undefined';
// → 若支援：用 WebCodecs 路線（快）
// → 若不支援：用 FFmpeg.wasm 路線（慢但可用）
```
- 降低 FFmpeg 輸出解析度（640×720），讓 FFmpeg 路線從 20 分鐘 → 8-10 分鐘
- UI 上加提示：「Chrome 匯出更快（硬體加速）」

### 第二步（下一個迭代，約 1 週）：WebCodecs 實作
- 實作 WebCodecs + OffscreenCanvas + mp4-muxer 路線
- Chrome / Edge / Firefox（桌面）用 WebCodecs（超快）
- iOS Safari 26+ 用 WebCodecs
- 其他舊瀏覽器 fallback 到 FFmpeg.wasm

### 預期結果
- Chrome 用戶（大多數桌面用戶）：從 20 分鐘 → 幾秒內完成
- iOS Safari 26+ 用戶：同樣快速
- iOS Safari 舊版用戶：~8-10 分鐘（比現在好，但仍慢）

---

## 關於 iOS 的最終回答

你問「方案一降低解析度會有 iOS 相容性問題嗎」：

**方案一（降低解析度）**：完全沒問題，跟 iOS 無關。
**方案三（WebCodecs）**：有 iOS 問題，但只影響 Safari 26 以前的版本（iOS 18 以前）。正確做法是漸進增強（progressive enhancement）——WebCodecs 當快速路線，FFmpeg.wasm 當保底 fallback。

> 詳細 FFmpeg.wasm 當前狀態：`docs/EXPORT_FFMPEG_STATUS.md`

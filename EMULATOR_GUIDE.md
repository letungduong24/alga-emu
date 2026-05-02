# Alga Emulator Integration Guide

> Tài liệu kỹ thuật cho việc tích hợp emulator vào Alga sử dụng LibretroDroid.
> Dùng làm tham chiếu khi thêm hệ máy mới (3DS, PSP, GBA...).

---

## 1. Tổng quan kiến trúc

```
┌─────────────────────────────────────────────────┐
│  React Native (TypeScript)                       │
│  src/hooks/useGameDownload.ts                    │
│    → Gọi AppLauncherModule.launchGame()          │
└──────────────────┬──────────────────────────────┘
                   │ Expo Module Bridge
┌──────────────────▼──────────────────────────────┐
│  Kotlin Native Module                            │
│  AppLauncherModule.kt                            │
│    → Start GameActivity với CORE_PATH + ROM_PATH │
└──────────────────┬──────────────────────────────┘
                   │ Android Intent
┌──────────────────▼──────────────────────────────┐
│  GameActivity.kt                                 │
│    → GLRetroView (LibretroDroid)                 │
│    → TouchControlsOverlay (Canvas-based UI)      │
│    → Save/Load State, SRAM, Lifecycle            │
└─────────────────────────────────────────────────┘
```

### Các file chính

| File | Vai trò |
|------|---------|
| `modules/app-launcher/android/build.gradle` | Dependencies (LibretroDroid, Lifecycle) |
| `modules/app-launcher/android/src/main/AndroidManifest.xml` | Đăng ký GameActivity |
| `AppLauncherModule.kt` | Bridge TS ↔ Kotlin |
| `GameActivity.kt` | Host emulator + lifecycle + save |
| `TouchControlsOverlay.kt` | UI nút bấm + settings panel |
| `src/hooks/useGameDownload.ts` | Download ROM + copy core + launch |

---

## 2. Dependency Setup

### build.gradle (module)
```gradle
dependencies {
    implementation "com.github.nicholasmata:LibretroDroid:v0.8.0"
    implementation "androidx.lifecycle:lifecycle-runtime-ktx:2.7.0"
    implementation "androidx.appcompat:appcompat:1.6.1"
}
```

### build.gradle (project root)
```gradle
allprojects {
    repositories {
        maven { url 'https://jitpack.io' }  // Bắt buộc cho LibretroDroid
    }
}
```

### Lưu ý version
- `LibretroDroid:v0.8.0` — fork ổn định, hỗ trợ `serializeState()`, `serializeSRAM()`, `updateVariables()`
- Nếu dùng bản gốc `swordfish90/LibretroDroid`, API có thể khác

---

## 3. Core Files (.so)

### Core là gì?
Mỗi hệ máy cần 1 file `.so` (shared library) — đây là engine emulation thực sự.

| Hệ máy | Core file | Libretro core name |
|---------|-----------|-------------------|
| NDS | `melonds_libretro_android.so` | melonDS |
| GBA | `mgba_libretro_android.so` | mGBA |
| 3DS | `citra_libretro_android.so` | Citra |
| PSP | `ppsspp_libretro_android.so` | PPSSPP |
| SNES | `snes9x_libretro_android.so` | Snes9x |

### Cách lấy core
1. **Buildbot**: `https://buildbot.libretro.com/nightly/android/latest/`
2. **Build từ source**: Clone repo core → build với Android NDK
3. **Từ RetroArch APK**: Extract `.so` files từ `lib/` trong APK

### Lưu trữ core
```
/storage/emulated/0/Alga/cores/
  ├── melonds_libretro_android.so
  ├── mgba_libretro_android.so
  └── citra_libretro_android.so
```

### ⚠️ BUG QUAN TRỌNG: Android noexec

Android 10+ mount external storage với flag `noexec` → không thể `dlopen()` file `.so` từ `/storage/emulated/0/`.

**Giải pháp bắt buộc**: Copy core vào internal storage trước khi load:

```kotlin
// useGameDownload.ts - copy core vào internal
val externalCore = File("/storage/emulated/0/Alga/cores/melonds_libretro_android.so")
val internalCore = File(context.filesDir, "cores/melonds_libretro_android.so")
if (!internalCore.exists() || externalCore.length() != internalCore.length()) {
    externalCore.copyTo(internalCore, overwrite = true)
}
// Dùng internalCore.absolutePath cho GLRetroViewData.coreFilePath
```

---

## 4. GameActivity Implementation

### 4.1 Khởi tạo GLRetroView

```kotlin
val viewData = GLRetroViewData(this).apply {
    coreFilePath = "/data/data/.../files/cores/melonds_libretro_android.so"
    gameFilePath = "/storage/emulated/0/Alga/roms/nds/game.nds"
    savesDirectory = File(filesDir, "saves").absolutePath
    systemDirectory = File(filesDir, "system").absolutePath
    shader = ShaderConfig.Default
    preferLowLatencyAudio = true
    rumbleEventsEnabled = false
    skipDuplicateFrames = false

    // Core-specific variables
    variables = arrayOf(
        Variable("melonds_screen_layout", "Left/Right"),
        Variable("melonds_touch_mode", "Touch"),
    )
}

retroView = GLRetroView(this, viewData)
lifecycle.addObserver(retroView!!)  // Lifecycle quản lý resume/pause/destroy
```

### 4.2 Lifecycle — THỨ TỰ RẤT QUAN TRỌNG

```
onCreate  → GLRetroView created → lifecycle.addObserver()
onResume  → super.onResume() → lifecycle dispatch ON_RESUME → LibretroDroid.resume()
onPause   → [SAVE SRAM HERE] → super.onPause() → ON_PAUSE → LibretroDroid.pause()
onDestroy → super.onDestroy() → ON_DESTROY → LibretroDroid.destroy() → cleanup
```

**Bug đã gặp và fix:**

```kotlin
// ❌ SAI — observer bị gỡ trước destroy → LibretroDroid.destroy() không chạy → CRASH lần sau
override fun onDestroy() {
    retroView?.let { lifecycle.removeObserver(it) }  // GỠ TRƯỚC
    super.onDestroy()  // destroy() không dispatch
}

// ✅ ĐÚNG — để lifecycle tự dispatch ON_DESTROY
override fun onDestroy() {
    super.onDestroy()  // → ON_DESTROY → GLRetroView cleanup → LibretroDroid.destroy()
    retroView = null
}
```

```kotlin
// ❌ SAI — save SRAM sau khi core đã pause
override fun onPause() {
    super.onPause()  // → core pause → SRAM có thể trống
    retroView?.serializeSRAM()
}

// ✅ ĐÚNG — save TRƯỚC khi core pause
override fun onPause() {
    retroView?.serializeSRAM()  // Core vẫn chạy → SRAM có data
    super.onPause()
}
```

### 4.3 Immersive Fullscreen

```kotlin
// Phải gọi SAU setContentView()
WindowCompat.setDecorFitsSystemWindows(window, false)
WindowInsetsControllerCompat(window, container).let { ctrl ->
    ctrl.hide(WindowInsetsCompat.Type.systemBars())
    ctrl.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
}
```

---

## 5. Save System

### 5.1 SRAM (In-game save)

Khi game ghi save → data vào **SRAM ảo trong RAM**. Phải serialize ra disk.

```kotlin
retroView?.serializeSRAM()  // RAM → file .sav trong savesDirectory
```

**Timing gọi serializeSRAM():**
- `onPause()` — trước `super.onPause()`
- Back button — trước `finish()`
- Auto-save timer — mỗi 30 giây

**Auto-save:**
```kotlin
private val handler = Handler(Looper.getMainLooper())
private val autoSave = object : Runnable {
    override fun run() {
        retroView?.serializeSRAM()
        handler.postDelayed(this, 30_000)
    }
}
// Start trong onCreate, stop trong onPause, restart trong onResume
```

### 5.2 Save State (Emulator save)

Lưu toàn bộ trạng thái emulator tại bất kỳ thời điểm nào.

```kotlin
// Save
val data: ByteArray = retroView?.serializeState()!!
File(statesDir, "game.slot0.state").writeBytes(data)

// Load
val data = File(statesDir, "game.slot0.state").readBytes()
retroView?.unserializeState(data)  // returns Boolean
```

### 5.3 External Storage Sync

Backup saves ra `/Alga/saves/` và `/Alga/states/` để user truy cập.
Import ngược lại khi mở game (external mới hơn → copy vào internal).

```
📁 /storage/emulated/0/Alga/
├── cores/          ← Core .so files
├── roms/
│   └── melonds/    ← ROM files
├── saves/          ← SRAM backup (.sav)
└── states/         ← Save state backup (.state)
```

---

## 6. Touch Controls Overlay

### Thiết kế
- **Canvas-based** — vẽ trực tiếp bằng Android Canvas API
- **Tại sao không dùng XML/Compose?** → Latency thấp nhất (~0ms vs 16ms+), 60FPS
- **Multi-touch** — track pointer ID → button mapping

### Responsive Layout

```kotlin
val unit = minOf(screenWidth, screenHeight) * 0.075f * userScale
val safeMargin = unit * 1.5f  // Đảm bảo nút không tràn viền

// D-pad: center-based positioning
val dpadCenter = Point(safeMargin + step, height - safeMargin - step)
// Up/Down/Left/Right tính từ center ± step

// ABXY: mirror bên phải
val abxyCenter = Point(width - safeMargin - step, height - safeMargin - step)
```

### Button Visibility
- Fill: `Color.argb(110, 0, 0, 0)` — bán trong suốt đen
- Stroke: `Color.argb(160, 255, 255, 255)` — viền trắng mờ
- Text shadow: `setShadowLayer(4f, 1f, 1f, darkColor)` — đọc được trên mọi nền

### Settings Panel
Menu items sử dụng `MenuItem(id, label, bounds)`. Touch detection bằng `bounds.contains(x, y)`.
Panel tự tính height dựa trên nội dung thực tế.

---

## 7. Core Variables (per platform)

Mỗi core có biến riêng để cấu hình. Dùng `retroView?.updateVariables()` để thay đổi runtime.

### melonDS (NDS)
```kotlin
Variable("melonds_screen_layout", "Left/Right")  // Top/Bottom, Top Only, Bottom Only, Hybrid Top
Variable("melonds_touch_mode", "Touch")
```

### mGBA (GBA)
```kotlin
Variable("mgba_solar_sensor_level", "0")  // Boktai games
Variable("mgba_color_correction", "Auto")
```

### Citra (3DS)
```kotlin
Variable("citra_resolution_factor", "1")  // 1x, 2x, 3x
Variable("citra_layout_option", "Default Top-Bottom Screen")
Variable("citra_use_hw_renderer", "enabled")
```

### PPSSPP (PSP)
```kotlin
Variable("ppsspp_rendering_mode", "Hardware")
Variable("ppsspp_internal_resolution", "1x")
Variable("ppsspp_frameskip", "0")
```

> **Cách tìm variables**: Mở RetroArch → Load core → Options → note tên biến.
> Hoặc xem source code của core trên GitHub.

---

## 8. Thêm hệ máy mới — Checklist

### Bước 1: Chuẩn bị core
- [ ] Download `.so` file cho platform target (arm64-v8a)
- [ ] Đặt vào `/Alga/cores/`
- [ ] Test `dlopen()` từ internal storage

### Bước 2: Cập nhật TypeScript
- [ ] Thêm platform config trong `useGameDownload.ts`
- [ ] Map file extension → core name (`.nds` → melonds, `.gba` → mgba)
- [ ] Copy core logic (external → internal)

### Bước 3: GameActivity
- [ ] Detect platform từ core path
- [ ] Set core-specific variables
- [ ] Test SRAM format (.sav, .srm — tùy core)

### Bước 4: Touch Controls
- [ ] Xác định nút cần thiết (NDS có L/R, PSP có analog stick)
- [ ] Thêm analog stick nếu cần (PSP, 3DS)
- [ ] Cập nhật settings panel (screen layout options khác nhau)

### Bước 5: Test
- [ ] Launch game thành công
- [ ] Save SRAM → thoát → vào lại → save còn
- [ ] Save State → Load State
- [ ] Speed toggle
- [ ] Screen layout (nếu có)
- [ ] Back button → clean exit, không crash

---

## 9. Các lỗi thường gặp

| Lỗi | Nguyên nhân | Fix |
|-----|-------------|-----|
| `Emulator error: 0` | Core không load được | Copy .so vào internal storage |
| Crash khi chơi lại | `LibretroDroid.destroy()` không chạy | Không remove lifecycle observer trước `super.onDestroy()` |
| Mất save | `serializeSRAM()` gọi sau core pause | Gọi trước `super.onPause()` |
| Black screen | Intent data sai | Check CORE_PATH, ROM_PATH trong log |
| App crash on launch | Core ABI mismatch | Dùng đúng `.so` cho CPU (arm64-v8a) |
| Nút tràn viền | Margin quá nhỏ | `safeMargin = unit * 1.5f` |

---

## 10. API Reference — GLRetroView

```kotlin
// Lifecycle
lifecycle.addObserver(retroView)  // Tự động resume/pause/destroy

// Input
retroView.sendKeyEvent(action, keyCode, port)  // ACTION_DOWN / ACTION_UP

// Speed
retroView.frameSpeed = 2  // 1x, 2x, 4x

// Variables
retroView.updateVariables(Variable("key", "value"))

// SRAM
retroView.serializeSRAM()    // Save battery RAM to savesDirectory

// State
retroView.serializeState(): ByteArray    // Snapshot toàn bộ state
retroView.unserializeState(data): Boolean  // Restore state

// Errors
retroView.getGLRetroErrors(): Flow<Int>  // Error stream
```

---

## 11. File Structure

```
modules/app-launcher/android/
├── build.gradle                    ← Dependencies
└── src/main/
    ├── AndroidManifest.xml         ← GameActivity registration
    └── java/expo/modules/applauncher/
        ├── AppLauncherModule.kt    ← TS ↔ Kotlin bridge
        ├── GameActivity.kt         ← Emulator host
        └── TouchControlsOverlay.kt ← Touch UI

/data/data/com.anonymous.algaemulatorlauncher/files/
├── cores/    ← Internal .so copies (executable)
├── saves/    ← SRAM files (.sav)
├── states/   ← Save state files (.state)
└── system/   ← BIOS/firmware (some cores need this)

/storage/emulated/0/Alga/
├── cores/    ← User-accessible .so files
├── roms/     ← ROM files organized by platform
├── saves/    ← SRAM backup (2-way sync)
└── states/   ← State backup (2-way sync)
```

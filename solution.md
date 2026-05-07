# Fix GBA Save Game Issue

## Context
User reports that GBA games (mGBA core) don't save properly - after saving in-game, exiting and re-entering causes save data to be lost. According to [mGBA LibRetro docs](https://docs.libretro.com/library/mgba/), the core saves to:
- Frontend's Save directory: `*.srm` (Cartridge battery save)
- Frontend's State directory: `*.state#` (State)

## Root Cause Analysis

After thorough investigation, found **3 critical bugs** in [GameActivity.kt](modules/app-launcher/android/src/main/java/expo/modules/applauncher/GameActivity.kt):

### Bug 1: Missing onPause() Override
**Current state:** GameActivity has NO `onPause()` method
**Impact:** When user presses Home or switches apps, SRAM in memory is NEVER flushed to disk
**Evidence:** [EMULATOR_GUIDE.md:172-176](EMULATOR_GUIDE.md#L172-L176) explicitly states: "✅ ĐÚNG — save TRƯỚC khi core pause: retroView?.serializeSRAM() rồi mới super.onPause()"

### Bug 2: Exit Flow Missing serializeSRAM()
**Current state:** [GameActivity.kt:462-499](modules/app-launcher/android/src/main/java/expo/modules/applauncher/GameActivity.kt#L462-L499) `performSafeExit()` only polls for file changes, never calls `serializeSRAM()`
**Impact:** When user exits via Back button, SRAM is not explicitly flushed before polling
**Evidence:** [EMULATOR_GUIDE.md:202-206](EMULATOR_GUIDE.md#L202-L206) states timing should be "Back button — trước finish()"

### Bug 3: Wrong Save File Extension in Exit Polling
**Current state:** Line 470 hardcodes `.sav` extension: `val saveFile = java.io.File(savesDir, "${romBaseName}.sav")`
**Impact:** For mGBA (GBA), the core writes `.srm` files, so polling never detects the save file change
**Evidence:** 
- [AppLauncherModule.kt:133](modules/app-launcher/android/src/main/java/expo/modules/applauncher/AppLauncherModule.kt#L133) shows mGBA uses `.srm`
- Current polling only works for melonDS (`.sav`), not mGBA or desmume (`.dsv`)

## Why melonDS Works But mGBA (and likely DeSmuME) Don't

**Important clarification:** Không phải "NDS works" mà là **chỉ melonDS works**. DeSmuME (NDS core khác) có thể cũng bị lỗi tương tự.

The exit polling was designed specifically for melonDS's **unique async save behavior** (see comment line 466: "MelonDS core ghi save bất đồng bộ"). melonDS works because:
1. melonDS core tự động flush SRAM bất đồng bộ ra disk, không cần explicit `serializeSRAM()` call
2. Extension `.sav` match với polling logic

**Cores khác (mGBA, DeSmuME, VBA, etc.) KHÔNG có async save behavior này** - chúng cần explicit `serializeSRAM()` call để flush SRAM từ RAM ra disk.

Vậy nên:
- ✅ melonDS: hoạt động vì tự flush + extension đúng
- ❌ mGBA: bị lỗi vì cần explicit call + extension sai (`.srm` vs `.sav`)
- ❓ DeSmuME: có thể cũng bị lỗi vì cần explicit call (dù extension `.dsv` có thể được detect nếu fix Bug 3)

**Kết luận:** Đây không phải bug riêng của GBA - đây là bug chung cho TẤT CẢ cores trừ melonDS. Fix này sẽ giúp mGBA, DeSmuME, và bất kỳ core nào khác được thêm sau này.

---

## Solution

### Fix 1: Add onPause() Override
Add proper lifecycle handling to flush SRAM when app goes to background:

```kotlin
override fun onPause() {
    android.util.Log.d("GameActivity", "onPause — flushing SRAM")
    retroView?.serializeSRAM()
    super.onPause()
}
```

**Location:** [GameActivity.kt:415](modules/app-launcher/android/src/main/java/expo/modules/applauncher/GameActivity.kt#L415) (after `onDestroy()`)

### Fix 2: Call serializeSRAM() Before Exit Polling
In `performSafeExit()`, explicitly flush SRAM before polling:

```kotlin
private fun performSafeExit() {
    android.util.Log.d("GameActivity", "Exit confirmed — flushing SRAM...")
    
    // Explicitly flush SRAM to disk
    retroView?.serializeSRAM()
    
    android.widget.Toast.makeText(this, "Đang thoát...", android.widget.Toast.LENGTH_SHORT).show()
    
    // Poll for save file changes...
```

**Location:** [GameActivity.kt:462-464](modules/app-launcher/android/src/main/java/expo/modules/applauncher/GameActivity.kt#L462-L464)

### Fix 3: Use Core-Specific Save Extension in Polling
Replace hardcoded `.sav` with dynamic extension lookup using existing boolean flags:

```kotlin
// Determine save extension based on core type (use existing flags)
val saveExt = when {
    isGBA -> ".srm"
    isMelonDS -> ".sav"
    else -> ".dsv"  // DeSmuME
}
val saveFile = java.io.File(savesDir, "${romBaseName}${saveExt}")
```

**Location:** [GameActivity.kt:469-470](modules/app-launcher/android/src/main/java/expo/modules/applauncher/GameActivity.kt#L469-L470)

**Note:** Reuses existing class properties `isGBA`, `isMelonDS` (lines 44-46) that are already set in `onCreate()`. No new properties needed.

---

## Critical Files to Modify

1. **[GameActivity.kt](modules/app-launcher/android/src/main/java/expo/modules/applauncher/GameActivity.kt)**
   - Add `onPause()` override after line 316 (`onDestroy()`)
   - Modify `performSafeExit()` at line 462 to call `serializeSRAM()` first
   - Replace hardcoded `.sav` at line 470 with core-specific extension logic

---

## Verification Plan

### Test Case 1: Background/Foreground (onPause)
1. Launch a GBA game (e.g., Pokemon)
2. Play and save in-game (use in-game save menu)
3. Press Home button (triggers `onPause()`)
4. Check logcat for "onPause — flushing SRAM"
5. Check `/data/data/com.anonymous.algaemulatorlauncher/files/saves/` for `.srm` file with recent timestamp
6. Re-open app and resume game
7. **Expected:** Save data persists

### Test Case 2: Exit via Back Button
1. Launch a GBA game
2. Play and save in-game
3. Press Back → "Thoát game?" → "Thoát"
4. Check logcat for "Exit confirmed — flushing SRAM..."
5. Check save file exists with recent timestamp
6. Re-launch game
7. **Expected:** Save data persists

### Test Case 3: Verify Other Cores Still Work
1. Test NDS game (melonDS) - should still work with `.sav`
2. Test NDS game (desmume) - should now work with `.dsv`
3. Test 3DS game (citra) - uses directory structure, should be unaffected

### Logcat Commands
```bash
# Watch save-related logs
adb logcat -s GameActivity:D | grep -i "save\|sram\|exit"

# Check save files
adb shell ls -lh /data/data/com.anonymous.algaemulatorlauncher/files/saves/
```

### Success Criteria
- ✅ GBA games persist saves after Home button
- ✅ GBA games persist saves after Back button exit
- ✅ NDS/3DS games continue to work as before
- ✅ Logcat shows SRAM flush on both `onPause()` and exit
- ✅ Save files have correct extensions (`.srm` for GBA, `.sav` for melonDS, `.dsv` for desmume)

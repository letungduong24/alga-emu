# GBA Save Game Bugfix Design

## Overview

This bugfix addresses three distinct but related bugs in GameActivity.kt that prevent LibRetro cores (particularly mGBA for GBA games) from persisting save data. The bugs manifest when users save in-game, exit or background the app, and then return to find their save data lost. The fix involves adding proper lifecycle handling for SRAM serialization, explicitly flushing SRAM before exit polling, and using core-specific save file extensions during exit detection. This is a targeted fix that preserves all existing behavior for melonDS (which has unique async save behavior) and other cores while enabling proper save persistence for mGBA, DeSmuME, and future LibRetro cores.

## Glossary

- **Bug_Condition (C)**: The condition that triggers save data loss - when SRAM is not flushed from memory to disk during app lifecycle events (onPause, exit) or when exit polling checks for the wrong save file extension
- **Property (P)**: The desired behavior - SRAM must be explicitly flushed to disk before lifecycle transitions and exit polling must check for the correct core-specific save file extension
- **Preservation**: Existing behavior that must remain unchanged - melonDS async save behavior, Citra directory-based saves, game state restoration, and idempotent serializeSRAM() calls
- **serializeSRAM()**: LibRetro API method that flushes SRAM (save RAM) from memory to disk as a save file
- **SRAM**: Save RAM - the in-memory representation of game save data that must be explicitly flushed to disk for LibRetro cores (except melonDS which does this asynchronously)
- **onPause()**: Android lifecycle method called when the app goes to background (Home button, app switching)
- **performSafeExit()**: Method in GameActivity.kt that handles the exit flow after user confirms exit via Back button
- **isGBA**: Boolean flag indicating if the current core is a GBA emulator (mGBA, VBA, gpSP)
- **isMelonDS**: Boolean flag indicating if the current core is melonDS (NDS emulator with async save behavior)

## Bug Details

### Bug Condition

The bug manifests in three distinct scenarios, all related to SRAM not being flushed from memory to disk or exit polling checking for the wrong file extension:

1. **Bug 1 - Missing onPause() Override**: When the user presses the Home button or switches apps (triggering onPause), GameActivity has no onPause() method, so SRAM is never flushed to disk
2. **Bug 2 - Missing serializeSRAM() Before Exit**: When the user exits via Back button and confirms, performSafeExit() polls for save file changes without first calling serializeSRAM() to flush SRAM to disk
3. **Bug 3 - Wrong Save File Extension**: When performSafeExit() polls for save file changes, it hardcodes `.sav` extension, but mGBA uses `.srm` and DeSmuME uses `.dsv`, causing the polling to never detect the save file

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type LifecycleEvent OR ExitEvent
  OUTPUT: boolean
  
  RETURN (input.type == "onPause" AND NOT onPauseOverrideExists())
         OR (input.type == "exit" AND NOT serializeSRAMCalledBeforePolling())
         OR (input.type == "exitPolling" AND saveFileExtension != coreSpecificExtension(currentCore))
END FUNCTION
```

### Examples

- **Bug 1 Example**: User plays Pokemon FireRed (GBA), saves in-game, presses Home button → onPause() is called but no serializeSRAM() happens → SRAM stays in memory → user force-closes app → save data lost
- **Bug 2 Example**: User plays Pokemon FireRed (GBA), saves in-game, presses Back → confirms exit → performSafeExit() polls for `.sav` file changes without calling serializeSRAM() first → SRAM never flushed → exit completes → save data lost
- **Bug 3 Example**: User plays Pokemon FireRed (GBA), saves in-game, presses Back → confirms exit → performSafeExit() calls serializeSRAM() (after Fix 2) → mGBA writes to `.srm` file → polling checks for `.sav` file → never detects change → timeout → exit completes but save may not be fully written
- **Edge Case - melonDS Works**: User plays Pokemon Black (NDS via melonDS), saves in-game, presses Back → melonDS core automatically flushes SRAM asynchronously → polling checks for `.sav` (correct for melonDS) → detects change → exit completes → save data persists (this is why the bug wasn't noticed earlier)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- melonDS async save behavior must continue to work exactly as before (no regression)
- Citra (3DS) directory-based save structure must remain unaffected
- Game state restoration after backgrounding must continue to work correctly
- Cancelled exit dialogs must not cause any side effects
- Multiple serializeSRAM() calls must remain idempotent and safe

**Scope:**
All inputs that do NOT involve the three bug conditions should be completely unaffected by this fix. This includes:
- melonDS save behavior (async flush continues to work)
- Citra save behavior (directory-based structure unaffected)
- Game state restoration after onResume()
- Exit dialog cancellation flow
- Redundant serializeSRAM() calls (idempotent behavior preserved)

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **Missing Lifecycle Hook**: GameActivity.kt has no onPause() override, so there is no opportunity to flush SRAM when the app goes to background. The EMULATOR_GUIDE.md explicitly states the correct pattern: "✅ ĐÚNG — save TRƯỚC khi core pause: retroView?.serializeSRAM() rồi mới super.onPause()"

2. **Exit Flow Design for melonDS Only**: The performSafeExit() method was designed specifically for melonDS's unique async save behavior (see comment line 466: "MelonDS core ghi save bất đồng bộ"). It polls for file changes but never explicitly calls serializeSRAM(), assuming the core will flush automatically. This works for melonDS but fails for all other LibRetro cores (mGBA, DeSmuME, VBA, etc.) which require explicit serializeSRAM() calls.

3. **Hardcoded Extension for melonDS**: The exit polling logic hardcodes `.sav` extension (line 470), which is correct for melonDS but wrong for mGBA (`.srm`) and DeSmuME (`.dsv`). This causes the polling to never detect save file changes for these cores, potentially causing premature exit before the save is fully written.

4. **Incomplete Core Support**: The codebase has boolean flags (isGBA, isMelonDS) and extension mappings in AppLauncherModule.kt, but these are not used in the exit polling logic, indicating the exit flow was only tested with melonDS.

## Correctness Properties

Property 1: Bug Condition - SRAM Flush on Lifecycle Events

_For any_ lifecycle event where the app goes to background (onPause) or the user confirms exit (performSafeExit), the fixed code SHALL explicitly call serializeSRAM() to flush SRAM from memory to disk before the lifecycle transition completes or exit polling begins.

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition - Core-Specific Extension in Exit Polling

_For any_ exit polling operation, the fixed code SHALL use the core-specific save file extension (`.srm` for mGBA, `.sav` for melonDS, `.dsv` for DeSmuME) when checking for save file changes, ensuring the polling correctly detects when the core has finished writing the save file.

**Validates: Requirements 2.3, 2.4, 2.5**

Property 3: Preservation - melonDS Async Save Behavior

_For any_ melonDS game session, the fixed code SHALL produce exactly the same save behavior as the original code, preserving the async save detection and polling logic that already works correctly for melonDS.

**Validates: Requirements 3.1**

Property 4: Preservation - Non-Affected Core Behavior

_For any_ Citra (3DS) game session or any other lifecycle event not involving onPause or exit (such as onResume, onCreate, onDestroy), the fixed code SHALL produce exactly the same behavior as the original code, preserving directory-based saves and other unaffected functionality.

**Validates: Requirements 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `modules/app-launcher/android/src/main/java/expo/modules/applauncher/GameActivity.kt`

**Fix 1 - Add onPause() Override**:
1. **Location**: After onDestroy() method (around line 415)
2. **Implementation**: Add new method override
   ```kotlin
   override fun onPause() {
       android.util.Log.d("GameActivity", "onPause — flushing SRAM")
       retroView?.serializeSRAM()
       super.onPause()
   }
   ```
3. **Rationale**: Ensures SRAM is flushed to disk when app goes to background (Home button, app switching)

**Fix 2 - Call serializeSRAM() Before Exit Polling**:
1. **Location**: performSafeExit() method, at the start (line 462-464)
2. **Implementation**: Add serializeSRAM() call before polling logic
   ```kotlin
   private fun performSafeExit() {
       android.util.Log.d("GameActivity", "Exit confirmed — flushing SRAM...")
       
       // Explicitly flush SRAM to disk
       retroView?.serializeSRAM()
       
       android.widget.Toast.makeText(this, "Đang thoát...", android.widget.Toast.LENGTH_SHORT).show()
       
       // Poll for save file changes...
   ```
3. **Rationale**: Ensures SRAM is flushed before polling for save file changes, giving the core time to write the save file

**Fix 3 - Use Core-Specific Save Extension in Polling**:
1. **Location**: performSafeExit() method, save file detection (line 469-470)
2. **Implementation**: Replace hardcoded `.sav` with dynamic extension using existing boolean flags
   ```kotlin
   // Determine save extension based on core type (use existing flags)
   val saveExt = when {
       isGBA -> ".srm"
       isMelonDS -> ".sav"
       else -> ".dsv"  // DeSmuME
   }
   val saveFile = java.io.File(savesDir, "${romBaseName}${saveExt}")
   ```
3. **Rationale**: Ensures polling checks for the correct save file extension for each core type, enabling proper save file change detection

**Key Technical Details**:
- Reuse existing boolean flags (isGBA, isMelonDS) defined at lines 44-46 - no new properties needed
- serializeSRAM() is idempotent - safe to call multiple times without side effects
- melonDS has async save behavior - doesn't need explicit serializeSRAM() but won't be harmed by it
- Citra uses directory-based saves - unaffected by these changes

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate the three bug scenarios on UNFIXED code to observe failures and understand the root cause. Use logcat to verify serializeSRAM() is NOT called in the unfixed code, and check save file timestamps to confirm SRAM is not flushed.

**Test Cases**:
1. **Bug 1 - onPause Test**: Launch GBA game, save in-game, press Home button → check logcat for missing "onPause — flushing SRAM" message → check save file timestamp (should NOT update) → re-open app and check save data (will be lost on unfixed code)
2. **Bug 2 - Exit Without Flush Test**: Launch GBA game, save in-game, press Back → confirm exit → check logcat for missing "Exit confirmed — flushing SRAM..." message → check save file timestamp (should NOT update) → re-launch game and check save data (will be lost on unfixed code)
3. **Bug 3 - Wrong Extension Test**: Launch GBA game, save in-game, press Back → confirm exit → check logcat for polling messages → verify polling checks for `.sav` instead of `.srm` → observe timeout or premature exit (will fail on unfixed code)
4. **melonDS Baseline Test**: Launch melonDS game, save in-game, press Back → confirm exit → verify save persists (should work on unfixed code, confirming melonDS is unaffected)

**Expected Counterexamples**:
- Bug 1: No logcat message for SRAM flush on onPause, save file timestamp unchanged, save data lost after backgrounding
- Bug 2: No logcat message for SRAM flush before exit, save file timestamp unchanged, save data lost after exit
- Bug 3: Logcat shows polling for `.sav` file when mGBA writes `.srm`, timeout occurs, save may be incomplete
- Possible causes: missing onPause() override, missing serializeSRAM() call in exit flow, hardcoded extension mismatch

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := handleLifecycleOrExit_fixed(input)
  ASSERT expectedBehavior(result)
END FOR
```

**Expected Behavior After Fix**:
- Bug 1: onPause() calls serializeSRAM(), logcat shows "onPause — flushing SRAM", save file timestamp updates, save data persists after backgrounding
- Bug 2: performSafeExit() calls serializeSRAM() before polling, logcat shows "Exit confirmed — flushing SRAM...", save file timestamp updates, save data persists after exit
- Bug 3: performSafeExit() checks for core-specific extension (`.srm` for mGBA), polling detects save file change, exit completes after save is written

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalFunction(input) = fixedFunction(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for melonDS, Citra, and other lifecycle events, then write property-based tests capturing that behavior.

**Test Cases**:
1. **melonDS Preservation**: Observe that melonDS saves work correctly on unfixed code (async flush + `.sav` extension), then write test to verify this continues after fix
2. **Citra Preservation**: Observe that Citra saves work correctly on unfixed code (directory-based structure), then write test to verify this continues after fix
3. **onResume Preservation**: Observe that game state restoration works correctly on unfixed code, then write test to verify this continues after fix
4. **Exit Dialog Cancel Preservation**: Observe that cancelling exit dialog works correctly on unfixed code, then write test to verify this continues after fix
5. **Idempotent serializeSRAM() Preservation**: Observe that multiple serializeSRAM() calls are safe on unfixed code, then write test to verify this continues after fix

### Unit Tests

- Test onPause() calls serializeSRAM() for GBA games
- Test performSafeExit() calls serializeSRAM() before polling for GBA games
- Test core-specific extension detection (`.srm` for mGBA, `.sav` for melonDS, `.dsv` for DeSmuME)
- Test save file timestamp updates after serializeSRAM() calls
- Test melonDS continues to work with async save behavior
- Test Citra continues to work with directory-based saves

### Property-Based Tests

- Generate random game sessions (GBA, NDS, 3DS) and verify save persistence after onPause and exit
- Generate random lifecycle event sequences and verify SRAM is flushed at correct times
- Generate random core types and verify correct save file extension is used in polling
- Test that all non-buggy lifecycle events (onResume, onCreate, onDestroy) continue to work across many scenarios

### Integration Tests

- Test full game flow: launch GBA game → save in-game → press Home → re-open app → verify save persists
- Test full exit flow: launch GBA game → save in-game → press Back → confirm exit → re-launch game → verify save persists
- Test melonDS full flow: launch NDS game (melonDS) → save in-game → exit → re-launch → verify save persists (no regression)
- Test Citra full flow: launch 3DS game → save in-game → exit → re-launch → verify save persists (no regression)
- Test mixed scenarios: switch between GBA and NDS games, verify saves persist for both

### Verification Commands

**Logcat Monitoring**:
```bash
# Watch save-related logs
adb logcat -s GameActivity:D | grep -i "save\|sram\|exit"
```

**Save File Inspection**:
```bash
# Check save files and timestamps
adb shell ls -lh /data/data/com.anonymous.algaemulatorlauncher/files/saves/
```

**Success Criteria**:
- ✅ GBA games persist saves after Home button (onPause)
- ✅ GBA games persist saves after Back button exit
- ✅ NDS games (melonDS) continue to persist saves (no regression)
- ✅ NDS games (DeSmuME) now persist saves correctly
- ✅ 3DS games (Citra) continue to persist saves (no regression)
- ✅ Logcat shows SRAM flush on both onPause() and exit
- ✅ Save files have correct extensions (`.srm` for GBA, `.sav` for melonDS, `.dsv` for DeSmuME)
- ✅ Save file timestamps update after SRAM flush
- ✅ No regressions in game state restoration or exit dialog behavior

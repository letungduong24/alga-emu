# Bug Condition Exploration Test - Execution Guide

## Overview

This guide explains how to run the bug condition exploration test for the GBA Save Game Fix. The test is designed to **FAIL on unfixed code** to confirm the bug exists, then **PASS on fixed code** to validate the fix.

## Test Location

- **Test File**: `modules/app-launcher/android/src/androidTest/java/expo/modules/applauncher/GameActivityBugConditionTest.kt`
- **Build Config**: `modules/app-launcher/android/build.gradle`

## Prerequisites

1. Android device or emulator connected via ADB
2. Android SDK installed with platform-tools
3. Gradle build system configured

## Running the Tests

### Option 1: Run All Bug Condition Tests

```bash
# From project root
cd modules/app-launcher/android
./gradlew connectedAndroidTest
```

### Option 2: Run Individual Test Cases

```bash
# Test Bug 1: SRAM Not Flushed on onPause
./gradlew connectedAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=expo.modules.applauncher.GameActivityBugConditionTest#testBugCondition_SRAMNotFlushedOnPause

# Test Bug 2: SRAM Not Flushed Before Exit
./gradlew connectedAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=expo.modules.applauncher.GameActivityBugConditionTest#testBugCondition_SRAMNotFlushedBeforeExit

# Test Bug 3: Wrong Save File Extension in Polling
./gradlew connectedAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=expo.modules.applauncher.GameActivityBugConditionTest#testBugCondition_WrongSaveFileExtensionInPolling
```

### Option 3: Run via ADB (Direct)

```bash
# Install the test APK
adb install -r modules/app-launcher/android/build/outputs/apk/androidTest/debug/app-launcher-debug-androidTest.apk

# Run specific test
adb shell am instrument -w -e class expo.modules.applauncher.GameActivityBugConditionTest expo.modules.applauncher.test/androidx.test.runner.AndroidJUnitRunner
```

## Expected Results

### On UNFIXED Code (Current State)

All three tests should **FAIL** with counterexamples:

1. **testBugCondition_SRAMNotFlushedOnPause**:
   - ❌ FAIL: No "onPause — flushing SRAM" in logcat
   - ❌ FAIL: Save file timestamp unchanged
   - **Counterexample**: onPause does not flush SRAM

2. **testBugCondition_SRAMNotFlushedBeforeExit**:
   - ❌ FAIL: No "Exit confirmed — flushing SRAM" in logcat
   - ❌ FAIL: Save file timestamp unchanged
   - **Counterexample**: performSafeExit does not flush SRAM before polling

3. **testBugCondition_WrongSaveFileExtensionInPolling**:
   - ❌ FAIL: Polling checks for .sav instead of .srm
   - ❌ FAIL: Correct .srm file exists but not detected
   - **Counterexample**: Exit polling uses wrong extension

### On FIXED Code (After Implementation)

All three tests should **PASS**:

1. **testBugCondition_SRAMNotFlushedOnPause**:
   - ✅ PASS: "onPause — flushing SRAM" found in logcat
   - ✅ PASS: Save file timestamp updated

2. **testBugCondition_SRAMNotFlushedBeforeExit**:
   - ✅ PASS: "Exit confirmed — flushing SRAM" found in logcat
   - ✅ PASS: Save file timestamp updated

3. **testBugCondition_WrongSaveFileExtensionInPolling**:
   - ✅ PASS: Polling checks for .srm for mGBA
   - ✅ PASS: Correct .srm file detected

## Monitoring Test Execution

### Watch Logcat During Test

```bash
# In a separate terminal, monitor GameActivity logs
adb logcat -s GameActivity:D | grep -i "save\|sram\|exit\|pause"
```

### Check Save Files

```bash
# List save files and timestamps
adb shell ls -lh /data/data/com.anonymous.algaemulatorlauncher/files/saves/
```

### View Test Results

```bash
# View detailed test report
cat modules/app-launcher/android/build/reports/androidTests/connected/index.html
```

## Interpreting Results

### Test Failures (Expected on Unfixed Code)

When tests fail, look for these counterexamples in the output:

```
COUNTEREXAMPLE: onPause does not flush SRAM - hasSRAMFlushLog=false, fileWasModified=false
COUNTEREXAMPLE: performSafeExit does not flush SRAM before polling - hasSRAMFlushBeforePolling=false, fileWasModified=false
COUNTEREXAMPLE: Exit polling uses wrong extension - pollingChecksCorrectExtension=false, correctFileExists=true, wrongFileExists=false
```

These counterexamples **confirm the bug exists** and validate our root cause analysis.

### Test Passes (Expected on Fixed Code)

When tests pass, the output should show:

```
✓ testBugCondition_SRAMNotFlushedOnPause PASSED
✓ testBugCondition_SRAMNotFlushedBeforeExit PASSED
✓ testBugCondition_WrongSaveFileExtensionInPolling PASSED
```

This confirms the fix works correctly.

## Troubleshooting

### Test Won't Run

1. Check device connection: `adb devices`
2. Verify Gradle sync: `./gradlew clean build`
3. Check Android SDK path in local.properties

### Logcat Not Showing Messages

1. Clear logcat: `adb logcat -c`
2. Increase log buffer: `adb logcat -G 16M`
3. Check log level: `adb shell setprop log.tag.GameActivity DEBUG`

### Save Files Not Found

1. Check app data directory exists: `adb shell ls /data/data/com.anonymous.algaemulatorlauncher/files/`
2. Create saves directory: `adb shell mkdir -p /data/data/com.anonymous.algaemulatorlauncher/files/saves/`
3. Check file permissions: `adb shell ls -la /data/data/com.anonymous.algaemulatorlauncher/files/saves/`

## Next Steps

After running these bug condition exploration tests:

1. **If tests FAIL** (expected): Proceed to implement the fix (Tasks 2-4)
2. **If tests PASS unexpectedly**: Re-investigate root cause - the bug may already be fixed or root cause analysis is incorrect
3. **Document counterexamples**: Save test output for reference during fix implementation

## References

- **Bugfix Requirements**: `.kiro/specs/gba-save-game-fix/bugfix.md`
- **Design Document**: `.kiro/specs/gba-save-game-fix/design.md`
- **Source Code**: `modules/app-launcher/android/src/main/java/expo/modules/applauncher/GameActivity.kt`

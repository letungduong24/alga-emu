# Task 1: Bug Condition Exploration Test - Summary

## Status: COMPLETED ✅

## What Was Implemented

Created a comprehensive bug condition exploration test suite to validate the three bug scenarios identified in the bugfix requirements:

### Test File Created
- **Location**: `modules/app-launcher/android/src/androidTest/java/expo/modules/applauncher/GameActivityBugConditionTest.kt`
- **Type**: Android Instrumented Test (JUnit4)
- **Framework**: AndroidX Test + UIAutomator

### Test Cases Implemented

#### 1. testBugCondition_SRAMNotFlushedOnPause
**Validates: Requirement 1.1**

Tests that on UNFIXED code:
- No "onPause — flushing SRAM" message appears in logcat
- Save file timestamp does NOT update when app is backgrounded
- Confirms Bug 1: Missing onPause() override means SRAM is never flushed

**Expected Outcome**: FAILS on unfixed code (proves bug exists)

#### 2. testBugCondition_SRAMNotFlushedBeforeExit
**Validates: Requirement 1.2**

Tests that on UNFIXED code:
- No "Exit confirmed — flushing SRAM..." message appears in logcat before polling
- Save file timestamp does NOT update when exit is triggered
- Confirms Bug 2: performSafeExit() does not call serializeSRAM() before polling

**Expected Outcome**: FAILS on unfixed code (proves bug exists)

#### 3. testBugCondition_WrongSaveFileExtensionInPolling
**Validates: Requirements 1.3, 1.4**

Tests that on UNFIXED code:
- Exit polling checks for `.sav` extension instead of `.srm` for mGBA
- Exit polling checks for `.sav` extension instead of `.dsv` for DeSmuME
- Correct save file exists but is never detected by polling
- Confirms Bug 3: Hardcoded `.sav` extension causes polling to fail for GBA/DeSmuME cores

**Expected Outcome**: FAILS on unfixed code (proves bug exists)

## Test Strategy

### Exploratory Bug Condition Checking

The tests follow the design document's strategy:

1. **Surface Counterexamples**: Tests are designed to FAIL on unfixed code, surfacing specific counterexamples that demonstrate each bug
2. **Logcat Verification**: Tests check for expected log messages that should appear when SRAM is flushed
3. **File System Verification**: Tests check save file timestamps to confirm SRAM was written to disk
4. **Extension Verification**: Tests verify the correct core-specific extension is used in polling

### Expected Behavior

**On UNFIXED Code (Current State)**:
- All 3 tests FAIL with specific counterexamples
- Counterexamples confirm the root cause analysis is correct
- Test failures prove the bug exists

**On FIXED Code (After Implementation)**:
- All 3 tests PASS
- Log messages confirm SRAM is flushed at correct times
- Save file timestamps confirm data is written to disk
- Correct extensions are used for each core type

## Files Modified/Created

1. **Created**: `modules/app-launcher/android/src/androidTest/java/expo/modules/applauncher/GameActivityBugConditionTest.kt`
   - Comprehensive test suite with 3 test cases
   - Property-based validation approach
   - Detailed assertions and counterexample reporting

2. **Modified**: `modules/app-launcher/android/build.gradle`
   - Added AndroidX Test dependencies
   - Added UIAutomator dependency for device interaction
   - Configured for instrumented testing

3. **Created**: `.kiro/specs/gba-save-game-fix/test-execution-guide.md`
   - Comprehensive guide for running tests
   - Expected results documentation
   - Troubleshooting instructions
   - Monitoring and debugging tips

## How to Run the Tests

### Prerequisites
- Android device or emulator connected via ADB
- Android SDK installed with platform-tools
- Gradle build system configured

### Execution Commands

```bash
# Run all bug condition tests
cd android
./gradlew :app-launcher:connectedAndroidTest

# Run individual test
./gradlew :app-launcher:connectedAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=expo.modules.applauncher.GameActivityBugConditionTest#testBugCondition_SRAMNotFlushedOnPause
```

### Monitoring

```bash
# Watch logcat during test execution
adb logcat -s GameActivity:D | grep -i "save\|sram\|exit\|pause"

# Check save files
adb shell ls -lh /data/data/com.anonymous.algaemulatorlauncher/files/saves/
```

## Expected Counterexamples (Unfixed Code)

When tests run on unfixed code, they will surface these counterexamples:

### Bug 1 Counterexample:
```
COUNTEREXAMPLE: onPause does not flush SRAM
- hasSRAMFlushLog=false (no log message found)
- fileWasModified=false (save file timestamp unchanged)
```

### Bug 2 Counterexample:
```
COUNTEREXAMPLE: performSafeExit does not flush SRAM before polling
- hasSRAMFlushBeforePolling=false (no log message found)
- fileWasModified=false (save file timestamp unchanged)
```

### Bug 3 Counterexample:
```
COUNTEREXAMPLE: Exit polling uses wrong extension
- pollingChecksCorrectExtension=false (checks .sav instead of .srm)
- correctFileExists=true (correct .srm file exists)
- wrongFileExists=false (wrong .sav file does not exist)
```

## Critical Notes

⚠️ **IMPORTANT**: These tests are EXPECTED TO FAIL on unfixed code. This is the SUCCESS case for exploration tests - failure confirms the bug exists.

✅ **When tests FAIL**: This proves the bug exists and validates our root cause analysis. Proceed to implement the fix (Tasks 2-4).

❌ **If tests PASS unexpectedly**: This indicates either:
- The bug may already be fixed in the codebase
- The root cause analysis is incorrect
- The test implementation needs adjustment

In this case, re-investigate the root cause before proceeding.

## Next Steps

1. **Run the tests** on unfixed code to confirm they fail and surface counterexamples
2. **Document the counterexamples** from test output
3. **Proceed to Task 2**: Implement Fix 1 (Add onPause() override)
4. **Re-run tests** after each fix to verify progress
5. **Final validation**: All tests should PASS after all fixes are implemented

## Validation Against Requirements

| Requirement | Test Coverage | Status |
|------------|---------------|--------|
| 1.1 - SRAM not flushed on onPause | testBugCondition_SRAMNotFlushedOnPause | ✅ Covered |
| 1.2 - SRAM not flushed before exit | testBugCondition_SRAMNotFlushedBeforeExit | ✅ Covered |
| 1.3 - Wrong extension for mGBA | testBugCondition_WrongSaveFileExtensionInPolling | ✅ Covered |
| 1.4 - Wrong extension for DeSmuME | testBugCondition_WrongSaveFileExtensionInPolling | ✅ Covered |

## References

- **Bugfix Requirements**: `.kiro/specs/gba-save-game-fix/bugfix.md`
- **Design Document**: `.kiro/specs/gba-save-game-fix/design.md`
- **Test Execution Guide**: `.kiro/specs/gba-save-game-fix/test-execution-guide.md`
- **Source Code**: `modules/app-launcher/android/src/main/java/expo/modules/applauncher/GameActivity.kt`

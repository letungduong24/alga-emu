# Bugfix Requirements Document

## Introduction

GBA games (mGBA core) and other LibRetro cores fail to persist save data after exiting or backgrounding the application. When users save in-game, exit the app, and re-enter, their save data is lost. This affects all LibRetro cores except melonDS, which has unique async save behavior. The root cause involves three distinct bugs in GameActivity.kt: missing lifecycle handling for SRAM serialization, missing explicit SRAM flush before exit, and incorrect save file extension detection during exit polling.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the user presses the Home button or switches apps (triggering onPause) THEN the system does not flush SRAM from memory to disk, causing save data loss

1.2 WHEN the user exits via the Back button and confirms exit THEN the system polls for save file changes without first flushing SRAM to disk, causing save data loss

1.3 WHEN the system polls for save file changes during exit for mGBA (GBA core) THEN the system checks for `.sav` extension instead of `.srm`, failing to detect the save file and potentially causing premature exit

1.4 WHEN the system polls for save file changes during exit for DeSmuME (NDS core) THEN the system checks for `.sav` extension instead of `.dsv`, failing to detect the save file and potentially causing premature exit

### Expected Behavior (Correct)

2.1 WHEN the user presses the Home button or switches apps (triggering onPause) THEN the system SHALL explicitly call serializeSRAM() to flush SRAM from memory to disk before calling super.onPause()

2.2 WHEN the user exits via the Back button and confirms exit THEN the system SHALL explicitly call serializeSRAM() to flush SRAM to disk before polling for save file changes

2.3 WHEN the system polls for save file changes during exit for mGBA (GBA core) THEN the system SHALL check for `.srm` extension to correctly detect save file modifications

2.4 WHEN the system polls for save file changes during exit for DeSmuME (NDS core) THEN the system SHALL check for `.dsv` extension to correctly detect save file modifications

2.5 WHEN the system polls for save file changes during exit for melonDS (NDS core) THEN the system SHALL continue to check for `.sav` extension as it currently does

### Unchanged Behavior (Regression Prevention)

3.1 WHEN melonDS (NDS core) saves data asynchronously THEN the system SHALL CONTINUE TO detect `.sav` file changes and wait appropriately before exit

3.2 WHEN the user plays a 3DS game using Citra core THEN the system SHALL CONTINUE TO handle saves using the existing directory-based structure without interference

3.3 WHEN the user resumes the app after backgrounding THEN the system SHALL CONTINUE TO restore the game state correctly

3.4 WHEN the user cancels the exit dialog THEN the system SHALL CONTINUE TO allow gameplay without any side effects from the cancelled exit

3.5 WHEN the system calls serializeSRAM() multiple times THEN the system SHALL CONTINUE TO handle redundant calls safely without data corruption

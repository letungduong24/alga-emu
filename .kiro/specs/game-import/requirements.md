# Requirements Document

## Introduction

This document specifies the requirements for the Game Import feature in Alga Emulator Launcher. The feature allows users to import ROM files (GBA, NDS, 3DS) from their device's local storage into the game library, with validation, metadata extraction, and optional cleanup of source files after successful import.

## Glossary

- **Import_System**: The component responsible for importing ROM files from device storage into the game library
- **File_Picker**: The UI component that allows users to select ROM files from device storage
- **Validator**: The component that validates ROM file format and integrity
- **Extractor**: The component that extracts game metadata and cover images from ROM files
- **Storage_Manager**: The component that manages file operations (copy, extract, delete)
- **Library_Manager**: The component that manages game metadata in AsyncStorage
- **User**: The person using the Alga Emulator Launcher application
- **ROM_File**: A game file with extensions .gba, .nds, .3ds, .cci, .cxi, or .3dsx
- **ZIP_File**: A compressed archive containing one or more ROM files
- **Game_Folder**: A directory in `/storage/emulated/0/Alga/roms/{emulator_id}/` containing an imported ROM
- **Cover_Image**: A PNG image extracted from NDS/3DS ROM files or stored separately for GBA games
- **Game_Metadata**: JSON data stored in AsyncStorage containing game information (id, name, platform, filename)
- **Source_File**: The original ROM or ZIP file selected by the user for import
- **Target_Directory**: The destination directory `/storage/emulated/0/Alga/roms/{emulator_id}/{game_folder}/`

## Requirements

### Requirement 1: File Selection

**User Story:** As a user, I want to select ROM or ZIP files from my device storage, so that I can import games into my library.

#### Acceptance Criteria

1. WHEN the user taps the import button, THE File_Picker SHALL display a file selection dialog
2. THE File_Picker SHALL allow selection of files with extensions .gba, .nds, .3ds, .cci, .cxi, .3dsx, and .zip
3. WHEN the user selects a file, THE File_Picker SHALL return the file URI and filename
4. IF the user cancels the file selection, THEN THE Import_System SHALL abort the import process without error

### Requirement 2: File Format Validation

**User Story:** As a user, I want the system to validate ROM files before import, so that I don't import corrupted or invalid files.

#### Acceptance Criteria

1. WHEN a file is selected, THE Validator SHALL check the file extension against supported formats
2. THE Validator SHALL verify that .gba files are for the mgba emulator
3. THE Validator SHALL verify that .nds files are for melonds or desmume emulators
4. THE Validator SHALL verify that .3ds, .cci, .cxi, and .3dsx files are for the citra emulator
5. IF the file extension is not supported, THEN THE Validator SHALL return an error message indicating the unsupported format
6. WHEN a ZIP file is selected, THE Validator SHALL verify that the ZIP contains at least one ROM file with a supported extension
7. IF a ZIP file contains no valid ROM files, THEN THE Validator SHALL return an error message indicating no valid ROMs found

### Requirement 3: File Import and Extraction

**User Story:** As a user, I want ROM files to be copied to the correct directory, so that the emulator can access them.

#### Acceptance Criteria

1. WHEN a valid ROM file is selected, THE Storage_Manager SHALL create a Game_Folder in the Target_Directory
2. THE Storage_Manager SHALL generate a unique folder name based on the ROM filename without extension
3. WHEN a raw ROM file is selected, THE Storage_Manager SHALL copy the file to the Game_Folder
4. WHEN a ZIP file is selected, THE Storage_Manager SHALL extract all ROM files to the Game_Folder
5. THE Storage_Manager SHALL preserve the original ROM filename during copy or extraction
6. IF the Target_Directory does not exist, THEN THE Storage_Manager SHALL create it with appropriate permissions
7. IF a Game_Folder with the same name already exists, THEN THE Storage_Manager SHALL append a numeric suffix to create a unique folder name

### Requirement 4: Progress Indication

**User Story:** As a user, I want to see progress during import, so that I know the operation is working.

#### Acceptance Criteria

1. WHEN import begins, THE Import_System SHALL display a progress indicator
2. THE Import_System SHALL show the current operation status (validating, copying, extracting, processing metadata)
3. WHILE a ZIP file is being extracted, THE Import_System SHALL display "Extracting..." status
4. WHILE metadata is being processed, THE Import_System SHALL display "Processing..." status
5. WHEN import completes successfully, THE Import_System SHALL display a success message with the game name

### Requirement 5: Metadata Extraction and Storage

**User Story:** As a user, I want imported games to appear in my library with proper metadata, so that I can identify and launch them.

#### Acceptance Criteria

1. WHEN a ROM file is imported, THE Library_Manager SHALL generate a unique negative integer ID for the game
2. THE Library_Manager SHALL extract the game name from the ROM filename by removing file extensions and common prefixes
3. THE Library_Manager SHALL determine the platform based on the ROM file extension
4. THE Library_Manager SHALL create Game_Metadata with fields: id, name, platform, filename, downloadUrl (empty), and size
5. THE Library_Manager SHALL add the Game_Metadata to the AsyncStorage key "alga_downloaded_games"
6. THE Library_Manager SHALL update the downloadedGames state in useDownloadManager
7. THE Library_Manager SHALL store the ROM file path in the romPaths map for quick access

### Requirement 6: Cover Image Extraction

**User Story:** As a user, I want imported NDS and 3DS games to display their cover images, so that I can visually identify games in my library.

#### Acceptance Criteria

1. WHEN an NDS ROM file is imported, THE Extractor SHALL extract the embedded icon to `/storage/emulated/0/Alga/covers/{game_id}.png`
2. WHEN a 3DS ROM file is imported, THE Extractor SHALL extract the embedded icon to `/storage/emulated/0/Alga/covers/{game_id}.png`
3. IF cover extraction fails, THEN THE Import_System SHALL continue the import process without error
4. WHERE the platform is GBA, THE Import_System SHALL skip cover extraction
5. THE Extractor SHALL create the covers directory if it does not exist

### Requirement 7: Source File Cleanup

**User Story:** As a user, I want the option to delete the original file after import, so that I can save storage space.

#### Acceptance Criteria

1. WHEN import completes successfully, THE Import_System SHALL display a confirmation dialog asking if the user wants to delete the Source_File
2. THE confirmation dialog SHALL display the Source_File path and size
3. THE confirmation dialog SHALL have two buttons: "Delete" and "Keep"
4. WHEN the user taps "Delete", THE Storage_Manager SHALL delete the Source_File
5. WHEN the user taps "Keep", THE Import_System SHALL close the dialog without deleting the Source_File
6. IF deletion fails, THEN THE Import_System SHALL display an error message but SHALL NOT revert the import

### Requirement 8: Error Handling

**User Story:** As a user, I want clear error messages when import fails, so that I can understand what went wrong.

#### Acceptance Criteria

1. IF file validation fails, THEN THE Import_System SHALL display an error message with the validation failure reason
2. IF file copy fails, THEN THE Import_System SHALL display an error message indicating insufficient storage or permission denied
3. IF ZIP extraction fails, THEN THE Import_System SHALL display an error message indicating the ZIP file is corrupted
4. IF metadata storage fails, THEN THE Import_System SHALL display an error message and SHALL clean up the copied ROM files
5. WHEN an error occurs, THE Import_System SHALL log the error details for debugging
6. THE Import_System SHALL ensure that partial imports are cleaned up when errors occur

### Requirement 9: Library Integration

**User Story:** As a user, I want imported games to appear immediately in my library, so that I can start playing without restarting the app.

#### Acceptance Criteria

1. WHEN import completes successfully, THE Import_System SHALL trigger a library refresh
2. THE imported game SHALL appear in the library screen for the correct emulator
3. THE imported game SHALL be playable immediately after import
4. THE library screen SHALL display the imported game with its cover image if available
5. THE library screen SHALL display the imported game with a fallback icon if no cover image is available

### Requirement 10: Import Button UI

**User Story:** As a user, I want an import button in the library screen, so that I can easily access the import feature.

#### Acceptance Criteria

1. THE library screen SHALL display an import button in the header toolbar
2. THE import button SHALL use an upload icon to indicate its purpose
3. WHEN the library is empty, THE empty state SHALL include an import button alongside the download button
4. THE import button SHALL be visible in both carousel and grid view modes
5. WHEN the import button is tapped, THE Import_System SHALL initiate the file selection process


# Implementation Plan: Game Import Feature

## Overview

This implementation plan breaks down the Game Import feature into discrete coding tasks. The feature enables users to import ROM files (GBA, NDS, 3DS) from device storage into the Alga Emulator Launcher game library, with validation, metadata extraction, cover image extraction, and optional source file cleanup.

The implementation follows a 3-layer architecture:
- **UI Layer**: Import button, progress indicators, and confirmation dialogs in library.tsx
- **Business Logic Layer**: useGameImport hook orchestrating the import workflow
- **Native Layer**: Reusing existing functions in AppLauncherModule.kt (no new native code required)

## Tasks

- [x] 1. Create useGameImport hook with core structure and state management
  - Create `src/hooks/useGameImport.tsx` file
  - Define ImportState interface (isImporting, progress, currentOperation, error)
  - Define ImportResult interface (success, game, sourceFilePath, error)
  - Define UseGameImportReturn interface (importState, startImport, cancelImport, deleteSourceFile)
  - Implement state management with useState for import state
  - Export useGameImport hook function
  - _Requirements: 1.1, 1.2, 1.3, 4.1, 4.2_

- [x] 2. Implement file validation logic
  - [x] 2.1 Create platform configuration mapping
    - Define PLATFORM_CONFIG constant with GBA, NDS, 3DS configurations
    - Map file extensions to emulator IDs (.gba → mgba, .nds → melonds/desmume, .3ds/.cci/.cxi/.3dsx → citra)
    - Include extractIcon flags for each platform
    - _Requirements: 2.2, 2.3, 2.4_

  - [x] 2.2 Implement validateFile function
    - Accept file URI and filename as parameters
    - Extract file extension from filename
    - Check extension against PLATFORM_CONFIG
    - Return validation result with platform, emulatorId, and error message if invalid
    - Handle .zip files as valid format
    - _Requirements: 2.1, 2.5, 2.6, 2.7_

  - [ ]* 2.3 Write unit tests for file validation
    - Test valid ROM extensions (.gba, .nds, .3ds, .cci, .cxi, .3dsx)
    - Test invalid extensions return appropriate error messages
    - Test ZIP files are accepted
    - Test platform mapping is correct for each extension
    - _Requirements: 2.1, 2.5_

- [x] 3. Implement metadata generation functions
  - [x] 3.1 Create generateGameId function
    - Generate stable negative ID from filename hash
    - Use hash algorithm to ensure uniqueness
    - Return negative integer in range -100000000 to -999999999
    - _Requirements: 5.1_

  - [x] 3.2 Create cleanGameName function
    - Remove .zip extension from filename
    - Remove ROM extensions (.gba, .nds, .3ds, etc.)
    - Remove numeric prefixes (e.g., "0001 - ")
    - Remove region tags in parentheses (e.g., "(USA)", "(Europe)")
    - Remove flags in brackets (e.g., "[!]", "[a]")
    - Trim whitespace and return cleaned name
    - _Requirements: 5.2_

  - [x] 3.3 Create generateGameMetadata function
    - Accept filename, platform, and romPath as parameters
    - Call generateGameId to create unique ID
    - Call cleanGameName to extract game name
    - Create ApiGame object with id, name, platform, filename, downloadUrl (empty), size (0)
    - Return ApiGame object
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 3.4 Write unit tests for metadata generation
    - Test unique IDs are generated consistently for same filename
    - Test game names are cleaned correctly (remove prefixes, parentheses, brackets)
    - Test platform is mapped correctly
    - Test ApiGame objects have all required fields
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 4. Implement file operations and ZIP extraction
  - [x] 4.1 Create generateUniqueFolderName function
    - Accept base directory and base name as parameters
    - Check if folder exists using fileExists native function
    - If exists, append numeric suffix (_1, _2, etc.)
    - Return unique folder name
    - _Requirements: 3.7_

  - [x] 4.2 Create copyRomFile function
    - Accept source URI, destination directory, and filename as parameters
    - Call createDirectory native function to create destination folder
    - Call copyFile native function to copy ROM file
    - Return destination file path
    - Handle errors and throw appropriate exceptions
    - _Requirements: 3.1, 3.3, 3.5, 3.6_

  - [x] 4.3 Create extractZipFile function
    - Import unzip from react-native-zip-archive
    - Accept ZIP URI and destination directory as parameters
    - Call createDirectory native function to create destination folder
    - Call unzip to extract ZIP contents
    - Call listFiles native function to find ROM files in extracted content
    - Filter files by supported ROM extensions
    - Throw NO_VALID_ROMS error if no ROM files found
    - Return array of ROM file paths
    - _Requirements: 3.4, 3.5, 3.6_

  - [ ]* 4.4 Write integration tests for file operations
    - Test copyRomFile with mocked native functions
    - Test extractZipFile with mocked unzip and listFiles
    - Test generateUniqueFolderName with existing folders
    - Test error handling for file operation failures
    - _Requirements: 3.1, 3.3, 3.4_

- [ ] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement cover image extraction
  - [x] 6.1 Create extractIconSilently function
    - Accept romPath, gameId, and platform as parameters
    - Check if platform supports icon extraction (NDS, 3DS)
    - Create covers directory using createDirectory native function
    - Determine cover path: `/storage/emulated/0/Alga/covers/{gameId}.png`
    - Call extractNdsIcon for NDS platform
    - Call extract3dsIcon for 3DS platform
    - Wrap in try-catch to handle errors silently (log but don't throw)
    - Return void (non-blocking operation)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 6.2 Write unit tests for icon extraction
    - Test extractIconSilently calls correct native function for NDS
    - Test extractIconSilently calls correct native function for 3DS
    - Test extractIconSilently skips extraction for GBA
    - Test extractIconSilently handles errors silently without throwing
    - _Requirements: 6.1, 6.2, 6.4_

- [-] 7. Implement main import workflow orchestration
  - [-] 7.1 Create startImport function
    - Accept emulatorId as parameter
    - Update import state to 'validating' operation
    - Open file picker using expo-document-picker with appropriate MIME types
    - Handle file picker cancellation (return success: false without error)
    - Extract filename from picker result
    - Call validateFile to check file format
    - If validation fails, return ImportResult with error
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 4.1, 4.2_

  - [ ] 7.2 Implement file copy/extraction in startImport
    - Determine if file is ZIP or raw ROM based on extension
    - Update import state to 'copying' or 'extracting' operation
    - Generate unique folder name using generateUniqueFolderName
    - Construct destination directory path: `/storage/emulated/0/Alga/roms/{emulatorId}/{folderName}`
    - If raw ROM: call copyRomFile
    - If ZIP: call extractZipFile and handle multiple ROMs
    - Store ROM file path for metadata generation
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.3, 4.4_

  - [ ] 7.3 Implement metadata processing in startImport
    - Update import state to 'processing' operation
    - Call generateGameMetadata to create ApiGame object
    - Get useDownloadManager hook instance
    - Call downloadManager.addToDownloaded to persist game metadata
    - Call extractIconSilently for cover image extraction (non-blocking)
    - Update import state to 'done' operation
    - Return ImportResult with success: true, game object, and sourceFilePath
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.1, 6.2, 4.5_

  - [ ] 7.4 Implement error handling in startImport
    - Wrap entire workflow in try-catch block
    - Map caught errors to user-friendly error messages
    - Clean up partial imports on failure (delete destination folder)
    - Update import state with error message
    - Return ImportResult with success: false and error message
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ]* 7.5 Write integration tests for import workflow
    - Test complete import flow for raw ROM file with mocked dependencies
    - Test complete import flow for ZIP file with mocked dependencies
    - Test error handling at validation stage
    - Test error handling at file operation stage
    - Test error handling at metadata storage stage
    - Test cleanup of partial imports on failure
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.6_

- [ ] 8. Implement source file cleanup functionality
  - [ ] 8.1 Create deleteSourceFile function
    - Accept filePath as parameter
    - Call deleteFileOrDir native function
    - Return boolean indicating success or failure
    - Handle errors and return false on failure
    - _Requirements: 7.4, 7.6_

  - [ ]* 8.2 Write unit tests for source file cleanup
    - Test deleteSourceFile calls native deleteFileOrDir
    - Test deleteSourceFile returns true on success
    - Test deleteSourceFile returns false on error
    - _Requirements: 7.4_

- [ ] 9. Implement cancelImport function
  - Create cancelImport function to abort ongoing import
  - Reset import state to idle
  - Note: Actual cancellation of file operations may not be possible, but state should be reset
  - _Requirements: 1.4_

- [ ] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Add import button to library.tsx UI
  - [ ] 11.1 Import useGameImport hook in library.tsx
    - Add import statement for useGameImport hook
    - Initialize hook at component level: `const { importState, startImport, deleteSourceFile } = useGameImport()`
    - _Requirements: 10.1, 10.2_

  - [ ] 11.2 Add import button to header toolbar
    - Add TouchableOpacity with Upload icon next to "Tải thêm" button
    - Style button with circular background (bg-white/10)
    - Set onPress handler to call startImport with current emulatorId
    - Ensure button is visible in both carousel and grid view modes
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ] 11.3 Add import button to empty state
    - Add TouchableOpacity with Upload icon next to "Tải game" button in empty state
    - Style consistently with existing empty state buttons
    - Set onPress handler to call startImport with current emulatorId
    - _Requirements: 10.3_

- [ ] 12. Implement progress indicator UI
  - [ ] 12.1 Create progress overlay component
    - Add conditional View overlay when importState.isImporting is true
    - Style with absolute positioning, black/80 background, centered content
    - Add ActivityIndicator with PRIMARY color
    - Add Text displaying current operation message
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ] 12.2 Create operation message mapping
    - Define OPERATION_MESSAGES constant mapping ImportOperation to Vietnamese messages
    - Map 'validating' → "Đang kiểm tra file..."
    - Map 'copying' → "Đang sao chép ROM..."
    - Map 'extracting' → "Đang giải nén..."
    - Map 'processing' → "Đang xử lý metadata..."
    - Map 'done' → "Hoàn tất!"
    - _Requirements: 4.2, 4.3, 4.4_

- [ ] 13. Implement source file cleanup dialog
  - [ ] 13.1 Add state for cleanup dialog
    - Add useState for showCleanupDialog boolean
    - Add useState for sourceFilePath string
    - Add useState for sourceFileSize number (optional)
    - _Requirements: 7.1, 7.2_

  - [ ] 13.2 Create cleanup confirmation dialog
    - Add CustomAlert component for cleanup confirmation
    - Set visible prop to showCleanupDialog state
    - Set icon to "🗑️"
    - Set title to "Xóa file gốc?"
    - Set message to display source file path and size
    - Set confirmText to "Xóa" with confirmColor "#ef4444"
    - Set cancelText to "Giữ lại"
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ] 13.3 Implement cleanup dialog handlers
    - Create handleDeleteSource function to call deleteSourceFile
    - Show success/error message after deletion attempt
    - Close dialog after user action
    - Trigger dialog display after successful import in startImport
    - _Requirements: 7.4, 7.5_

- [ ] 14. Implement success and error message dialogs
  - [ ] 14.1 Add state for success/error alerts
    - Add useState for importAlert with title and message fields
    - _Requirements: 4.5, 8.1, 8.2, 8.3, 8.4_

  - [ ] 14.2 Create success/error alert component
    - Add CustomAlert component for import feedback
    - Set visible prop to !!importAlert
    - Display importAlert.title and importAlert.message
    - Set confirmText to "OK" with PRIMARY color
    - Close alert on confirm
    - _Requirements: 4.5, 8.1, 8.2, 8.3, 8.4_

  - [ ] 14.3 Trigger alerts from import workflow
    - Show success alert with game name after successful import
    - Show error alert with user-friendly message on import failure
    - Map error codes to Vietnamese error messages
    - _Requirements: 4.5, 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 15. Implement library refresh after import
  - [ ] 15.1 Trigger library refresh on import success
    - After successful import, ensure downloadedGames state is updated
    - Verify useDownloadManager.addToDownloaded triggers re-render
    - Ensure imported game appears immediately in library list
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ] 15.2 Verify cover image display
    - Ensure CoverImage component loads extracted cover for NDS/3DS games
    - Ensure fallback icon displays for GBA games
    - Test cover image loading from `/storage/emulated/0/Alga/covers/{gameId}.png`
    - _Requirements: 9.4, 9.5_

- [ ] 16. Final checkpoint - Ensure all tests pass and manual testing
  - Ensure all tests pass, ask the user if questions arise.
  - Verify import button is visible and functional in all view modes
  - Test complete import workflow with GBA, NDS, and 3DS ROM files
  - Test ZIP file import with single and multiple ROMs
  - Test source file cleanup dialog and deletion
  - Test error handling for invalid files and corrupted ZIPs
  - Verify imported games appear immediately and are playable

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at reasonable breaks
- All native functions (createDirectory, copyFile, deleteFileOrDir, extractNdsIcon, extract3dsIcon, fileExists, listFiles) already exist in AppLauncherModule.kt - no new native code required
- ZIP extraction uses existing react-native-zip-archive library
- File picker uses existing expo-document-picker library
- The feature integrates with existing useDownloadManager hook for state management
- Property-based testing is NOT included because this feature is I/O-heavy and not suitable for PBT
- Unit tests and integration tests focus on pure functions (validation, metadata generation) and workflow orchestration with mocked dependencies

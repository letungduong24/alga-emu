# Bugfix Requirements Document

## Introduction

The Fix menu in the 3DS library has multiple issues related to MiiFix download functionality. The primary problems are: (1) MiiFix download not properly using the download manager system, (2) re-downloading MiiFix even when it already exists in the library, (3) displaying incorrect status messages mentioning "nand" instead of MiiFix download progress, and (4) the header having too many action buttons (Search, Grid/List, Fix, Import, Add game) causing UI overflow. The solution is to consolidate the Fix and Import buttons into a single "More" menu in the header. These issues prevent users from efficiently downloading and using MiiFix to fix Tomodachi Life Mii creation errors, and the header overflow degrades the user experience.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN user clicks "Fix Tomodachi Life" button THEN the system does not use the download manager's `startDownload` function properly with correct parameters

1.2 WHEN MiiFix already exists in the library (ID -999999) and the MiiFix.3ds file exists on disk THEN the system still re-downloads the file instead of showing instructions

1.3 WHEN user clicks "Fix Tomodachi Life" and download starts THEN the system shows status message "đang fix nand" (fixing nand) instead of showing MiiFix download progress

1.4 WHEN the 3DS library header is rendered with multiple action buttons (Search, Grid/List toggle, Fix, Import, Add game) THEN the header UI overflows/wraps because there are too many items in a single row

1.5 WHEN user wants to access Fix or Import functions THEN they must find the separate buttons in the crowded header

### Expected Behavior (Correct)

2.1 WHEN user clicks "Fix Tomodachi Life" button THEN the system SHALL call `downloadManager.startDownload()` with a properly constructed MiiFix game object (id: -999999, name: 'MiiFix', platform: '3ds', downloadUrl: 'https://duongle.dev/MiiFix.3ds'), romDir path, and romExtensions array

2.2 WHEN MiiFix already exists in the library (ID -999999) and the MiiFix.3ds file exists on disk THEN the system SHALL display an alert with title "MiiFix đã có sẵn" and instructions without re-downloading

2.3 WHEN user clicks "Fix Tomodachi Life" and download starts THEN the system SHALL display status message "Đang tải MiiFix" with download progress and instructions

2.4 WHEN the 3DS library header is rendered THEN the header SHALL have a single "More" menu button (3-dot icon) that opens a menu containing "Import Game" and "Fix" options, AND the separate Fix and Import buttons SHALL be removed from the header

2.5 WHEN user clicks the "More" menu button in the header THEN the system SHALL display a menu with "Import Game" and "Fix" options

2.6 WHEN user clicks "Import Game" in the More menu THEN the system SHALL trigger the game import flow

2.7 WHEN user clicks "Fix" in the More menu THEN the system SHALL open the Fix submenu with "Tomodachi Life - Nand" and "Bật bàn phím ảo" options

### Unchanged Behavior (Regression Prevention)

3.1 WHEN user clicks "Fix Citra Keyboard" in the Fix menu THEN the system SHALL CONTINUE TO write Citra config file with keyboard_enabled = true

3.2 WHEN MiiFix download completes successfully THEN the system SHALL CONTINUE TO add MiiFix to the library with ID -999999 and refresh the library display

3.3 WHEN any download is in progress THEN the download manager SHALL CONTINUE TO show real-time progress with speed tracking and background download support

3.4 WHEN user navigates to the library screen THEN the system SHALL CONTINUE TO scan local library and display all downloaded games including MiiFix

3.5 WHEN the per-game action menu (3-dot menu) is opened for any game THEN the system SHALL CONTINUE TO display Play, Export Save, Import Save, and Delete options (NOT the Fix option)

3.6 WHEN the header More menu is opened THEN the system SHALL display Import Game and Fix options

3.7 WHEN the Fix submenu is opened from the header More menu THEN the system SHALL CONTINUE TO display both "Tomodachi Life - Nand" and "Bật bàn phím ảo" options

## Bug Condition and Property

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type FixTomodachiLifeAction
  OUTPUT: boolean
  
  // Returns true when any of the 4 bug conditions are met
  RETURN (
    X.downloadManagerNotUsedProperly OR
    X.redownloadsWhenExists OR
    X.showsWrongStatusMessage OR
    X.fixButtonTooLarge
  )
END FUNCTION
```

### Property Specification - Fix Checking

```pascal
// Property 1: Download Manager Usage
FOR ALL X WHERE X.downloadManagerNotUsedProperly DO
  result ← handleFixTomodachiLife'(X)
  ASSERT result.usesDownloadManager = true AND
         result.gameObject.id = -999999 AND
         result.gameObject.downloadUrl = 'https://duongle.dev/MiiFix.3ds' AND
         result.romDir = 'citra' AND
         result.romExtensions = ['.3ds', '.cci', '.cxi', '.3dsx']
END FOR

// Property 2: Existence Check
FOR ALL X WHERE X.redownloadsWhenExists DO
  result ← handleFixTomodachiLife'(X)
  ASSERT (X.miiFixExists AND X.fileExists) IMPLIES
         (result.showsAlert = true AND result.alertTitle = 'MiiFix đã có sẵn' AND result.downloadsFile = false)
END FOR

// Property 3: Status Message
FOR ALL X WHERE X.showsWrongStatusMessage DO
  result ← handleFixTomodachiLife'(X)
  ASSERT result.alertMessage CONTAINS 'Đang tải MiiFix' AND
         result.alertMessage NOT CONTAINS 'nand'
END FOR

// Property 4: Header Menu Consolidation
FOR ALL X WHERE X.fixButtonTooLarge DO
  result ← renderHeader'(X)
  ASSERT result.headerContainsSeparateFixButton = false AND
         result.headerContainsSeparateImportButton = false AND
         result.headerContainsMoreMenuButton = true AND
         result.moreMenuContainsImportOption = true AND
         result.moreMenuContainsFixOption = true
END FOR
```

### Preservation Property

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT handleFixTomodachiLife(X) = handleFixTomodachiLife'(X) AND
         handleFixCitraKeyboard(X) = handleFixCitraKeyboard'(X) AND
         downloadManager.behavior(X) = downloadManager.behavior'(X)
END FOR
```

**Key Definitions:**
- **F**: The original (unfixed) `handleFixTomodachiLife` function and Fix button rendering
- **F'**: The fixed `handleFixTomodachiLife` function and Fix button rendering

## Counterexamples

### Example 1: Download Manager Not Used Properly
```typescript
// Current (buggy) behavior
handleFixTomodachiLife() {
  // Does not call downloadManager.startDownload with correct parameters
  // Missing proper game object construction
}

// Expected (correct) behavior
handleFixTomodachiLife() {
  const miiFixGame: ApiGame = {
    id: -999999,
    name: 'MiiFix',
    platform: '3ds',
    downloadUrl: 'https://duongle.dev/MiiFix.3ds',
    filename: 'MiiFix.zip',
    size: 0,
  };
  downloadManager.startDownload(miiFixGame, 'citra', ['.3ds', '.cci', '.cxi', '.3dsx']);
}
```

### Example 2: Re-downloads When Exists
```typescript
// Input: MiiFix exists in library (ID -999999) and file exists on disk
// Current: Downloads file again
// Expected: Shows alert "MiiFix đã có sẵn" with instructions, no download
```

### Example 3: Wrong Status Message
```typescript
// Current: Alert message contains "đang fix nand"
// Expected: Alert message contains "Đang tải MiiFix"
```

### Example 4: Header Overflow from Too Many Buttons
```tsx
// Current: Too many separate buttons in header
<View className="flex-row items-center gap-x-2">
  <TouchableOpacity>Search</TouchableOpacity>
  <TouchableOpacity>Grid/List</TouchableOpacity>
  <TouchableOpacity>Fix (Wrench)</TouchableOpacity>  // Causes overflow
  <TouchableOpacity>Import (Upload)</TouchableOpacity>  // Causes overflow
  <TouchableOpacity>Add game (Plus)</TouchableOpacity>
</View>

// Expected: Consolidate Fix and Import into More menu
// Header buttons: Search, Grid/List, More (3-dot), Add game
// More menu contains:
//   - Import Game
//   - Fix (opens submenu with Tomodachi Life fix and Keyboard fix)
```

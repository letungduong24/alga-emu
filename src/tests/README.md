# AsyncStorage Persistence Layer Tests

## Overview

This directory contains tests for the AsyncStorage persistence layer used in the Backup/Restore System. The tests verify that AsyncStorage is properly configured and can reliably read/write game data to the `alga_downloaded_games` key.

## Requirements Covered

- **Requirement 3.5**: Restore_Manager SHALL skip downloading games that are already present in the Downloaded_Games_List
- **Requirement 3.6**: Restore_Manager SHALL restore Cover_Images to storage directory
- **Requirement 4.5**: Restore_Manager SHALL update the Downloaded_Games_List after each successful game download

## Files

### `asyncStoragePersistence.test.ts`

Core test file containing:

- **`testApiGameInterface()`**: Verifies the ApiGame interface structure has all required fields
- **`testAsyncStorageReadWrite()`**: Tests read/write operations for the `alga_downloaded_games` key
- **`runAllTests()`**: Executes all tests in sequence

### `runAsyncStorageTest.tsx`

React Native component that provides a UI for running the tests. Can be temporarily added to the app for manual testing.

## AsyncStorage Configuration

### Package

The project uses `@react-native-async-storage/async-storage` version 2.2.0.

```json
"@react-native-async-storage/async-storage": "2.2.0"
```

### Storage Key

```typescript
const DOWNLOADED_GAMES_KEY = 'alga_downloaded_games';
```

### Data Structure

The `alga_downloaded_games` key stores a JSON array of `ApiGame` objects:

```typescript
interface ApiGame {
  id: number;              // Unique game identifier
  name: string;            // Game name
  platform: string;        // Platform: 'gba', 'nds', '3ds'
  downloadUrl: string;     // Download URL for the game
  filename: string;        // Filename (e.g., 'pokemon_firered.zip')
  size: number;            // File size in bytes
}
```

## Running the Tests

### Method 1: Programmatic (Recommended for CI/CD)

```typescript
import { runAllTests } from '@/tests/asyncStoragePersistence.test';

// Run tests
await runAllTests();
```

### Method 2: UI Component (Manual Testing)

1. Import the test runner component:

```typescript
import { AsyncStorageTestRunner } from '@/tests/runAsyncStorageTest';
```

2. Temporarily add it to your app (e.g., in a settings screen):

```typescript
<AsyncStorageTestRunner />
```

3. Tap "Run Tests" button to execute the test suite

### Method 3: Console (Development)

```typescript
import { testAsyncStorageReadWrite, testApiGameInterface } from '@/tests/asyncStoragePersistence.test';

// Test interface structure
testApiGameInterface();

// Test read/write operations
await testAsyncStorageReadWrite();
```

## Test Coverage

### ✅ Test Cases

1. **Write Operation**: Write array of games to AsyncStorage
2. **Read Operation**: Read back and verify data integrity
3. **Data Validation**: Verify all fields match original data
4. **Empty Array**: Test storing and retrieving empty array
5. **Missing Key**: Test behavior when key doesn't exist
6. **Interface Structure**: Verify ApiGame has all required fields

### Expected Output

```
🚀 Starting AsyncStorage Persistence Layer Tests

🧪 Testing ApiGame interface structure...
✅ ApiGame interface structure verified!
   Required fields: id, name, platform, downloadUrl, filename, size

🧪 Testing AsyncStorage read/write operations...
  ✓ Clearing existing data...
  ✓ Writing test games to AsyncStorage...
  ✓ Reading games from AsyncStorage...
  ✓ Parsed games: 3
  ✓ Data integrity verified
  ✓ Testing empty array...
  ✓ Empty array test passed
  ✓ Testing missing key...
  ✓ Missing key test passed
✅ All AsyncStorage tests passed!
   Verified read/write operations for key: "alga_downloaded_games"

✅ All tests completed successfully!
```

## Integration with useDownloadManager

The `useDownloadManager` hook already implements AsyncStorage persistence:

```typescript
// Load persisted games on mount
useEffect(() => {
  const loadPersisted = async () => {
    const raw = await AsyncStorage.getItem(DOWNLOADED_GAMES_KEY);
    if (raw) {
      const games: ApiGame[] = JSON.parse(raw);
      setDownloadedGames(games);
    }
  };
  loadPersisted();
}, []);

// Persist after changes
const persistDownloadedGames = async (games: ApiGame[]) => {
  await AsyncStorage.setItem(DOWNLOADED_GAMES_KEY, JSON.stringify(games));
};
```

## Error Handling

The tests include error handling for:

- Failed read operations
- Failed write operations
- Data corruption (invalid JSON)
- Missing keys
- Type mismatches

## Next Steps

After verifying AsyncStorage functionality:

1. ✅ **Task 1 Complete**: AsyncStorage persistence layer verified
2. **Task 2**: Implement Kotlin native backup functions
3. **Task 3**: Implement useBackupRestore hook
4. **Task 4**: Implement Settings UI

## Notes

- AsyncStorage is asynchronous and returns Promises
- Data is stored as JSON strings and must be parsed after retrieval
- The `alga_downloaded_games` key is the single source of truth for downloaded games
- AsyncStorage persists across app restarts
- Maximum storage size varies by platform (typically 6MB on Android, unlimited on iOS)

## Troubleshooting

### Test Fails: "Failed to read data from AsyncStorage"

- Verify AsyncStorage is properly linked in native modules
- Check that the app has storage permissions
- Try clearing app data and running tests again

### Test Fails: "Data mismatch"

- Check for JSON serialization issues
- Verify ApiGame interface matches expected structure
- Look for data corruption in AsyncStorage

### Test Fails: "Missing required field"

- Verify ApiGame interface definition in `src/hooks/useGameApi.ts`
- Check that all required fields are present in test data

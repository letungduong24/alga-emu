# Quick Start: AsyncStorage Persistence Layer

## TL;DR

AsyncStorage is configured and ready to use. The `alga_downloaded_games` key stores an array of `ApiGame` objects.

## Basic Usage

### Read Games from AsyncStorage

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiGame } from '@/hooks/useGameApi';

const DOWNLOADED_GAMES_KEY = 'alga_downloaded_games';

async function getDownloadedGames(): Promise<ApiGame[]> {
  const raw = await AsyncStorage.getItem(DOWNLOADED_GAMES_KEY);
  if (!raw) return [];
  return JSON.parse(raw);
}
```

### Write Games to AsyncStorage

```typescript
async function saveDownloadedGames(games: ApiGame[]): Promise<void> {
  await AsyncStorage.setItem(DOWNLOADED_GAMES_KEY, JSON.stringify(games));
}
```

### Add a Game

```typescript
async function addGame(game: ApiGame): Promise<void> {
  const games = await getDownloadedGames();
  
  // Check if already exists
  if (games.find(g => g.id === game.id)) {
    return; // Already downloaded
  }
  
  // Add and save
  games.push(game);
  await saveDownloadedGames(games);
}
```

### Check if Game is Downloaded

```typescript
async function isGameDownloaded(gameId: number): Promise<boolean> {
  const games = await getDownloadedGames();
  return games.some(g => g.id === gameId);
}
```

### Remove a Game

```typescript
async function removeGame(gameId: number): Promise<void> {
  const games = await getDownloadedGames();
  const filtered = games.filter(g => g.id !== gameId);
  await saveDownloadedGames(filtered);
}
```

## Run Tests

### Option 1: Import and Run

```typescript
import { runAllTests } from '@/tests/asyncStoragePersistence.test';

await runAllTests();
```

### Option 2: Use UI Component

```typescript
import { AsyncStorageTestRunner } from '@/tests/runAsyncStorageTest';

// In your component
<AsyncStorageTestRunner />
```

## Type Definitions

All types are available in `src/types/backup.ts`:

```typescript
import { 
  ApiGame,
  BackupManifest,
  RestoreResult,
  BackupInfo,
  STORAGE_KEYS 
} from '@/types/backup';
```

## Example: Backup Creation

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/types/backup';

async function createBackup() {
  // 1. Read downloaded games
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.DOWNLOADED_GAMES);
  const games = raw ? JSON.parse(raw) : [];
  
  // 2. Create manifest
  const manifest = {
    version: '1.0',
    createdAt: new Date().toISOString(),
    games: games.map(g => ({
      id: g.id,
      name: g.name,
      platform: g.platform,
      downloadUrl: g.downloadUrl,
      filename: g.filename,
    })),
    saveFiles: [],
    coverFiles: [],
  };
  
  // 3. Pass to native module for ZIP creation
  // (Implementation in Task 2)
}
```

## Example: Restore Operation

```typescript
async function restoreBackup(manifest: BackupManifest) {
  // 1. Read current games
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.DOWNLOADED_GAMES);
  const currentGames = raw ? JSON.parse(raw) : [];
  const currentIds = new Set(currentGames.map(g => g.id));
  
  // 2. Filter games to download
  const gamesToDownload = manifest.games.filter(g => !currentIds.has(g.id));
  
  // 3. Download each game sequentially
  for (const game of gamesToDownload) {
    await downloadGame(game);
    
    // 4. Update AsyncStorage after each download
    const updated = await AsyncStorage.getItem(STORAGE_KEYS.DOWNLOADED_GAMES);
    const games = updated ? JSON.parse(updated) : [];
    games.push(game);
    await AsyncStorage.setItem(STORAGE_KEYS.DOWNLOADED_GAMES, JSON.stringify(games));
  }
}
```

## Common Patterns

### Safe Read with Default

```typescript
async function safeGetGames(): Promise<ApiGame[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.DOWNLOADED_GAMES);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('Failed to read games:', error);
    return [];
  }
}
```

### Atomic Update

```typescript
async function updateGames(updater: (games: ApiGame[]) => ApiGame[]): Promise<void> {
  const games = await safeGetGames();
  const updated = updater(games);
  await AsyncStorage.setItem(STORAGE_KEYS.DOWNLOADED_GAMES, JSON.stringify(updated));
}

// Usage
await updateGames(games => [...games, newGame]);
```

### Merge Strategy

```typescript
async function mergeGames(newGames: ApiGame[]): Promise<void> {
  const existing = await safeGetGames();
  const existingIds = new Set(existing.map(g => g.id));
  
  const toAdd = newGames.filter(g => !existingIds.has(g.id));
  const merged = [...existing, ...toAdd];
  
  await AsyncStorage.setItem(STORAGE_KEYS.DOWNLOADED_GAMES, JSON.stringify(merged));
}
```

## Troubleshooting

### Issue: Data not persisting

**Solution**: Ensure you're using `await` when calling AsyncStorage methods.

```typescript
// ❌ Wrong
AsyncStorage.setItem(key, value); // Missing await

// ✅ Correct
await AsyncStorage.setItem(key, value);
```

### Issue: JSON parse error

**Solution**: Always check if data exists before parsing.

```typescript
// ❌ Wrong
const games = JSON.parse(await AsyncStorage.getItem(key));

// ✅ Correct
const raw = await AsyncStorage.getItem(key);
const games = raw ? JSON.parse(raw) : [];
```

### Issue: Type errors

**Solution**: Import types from the correct location.

```typescript
import { ApiGame } from '@/hooks/useGameApi';
// or
import { ApiGame } from '@/types/backup';
```

## Performance Tips

1. **Batch reads**: Read once, use multiple times
2. **Debounce writes**: Don't write on every change
3. **Use refs**: Store in-memory copy for frequent access
4. **Lazy load**: Only read when needed

## See Also

- Full documentation: `src/tests/README.md`
- Type definitions: `src/types/backup.ts`
- Test suite: `src/tests/asyncStoragePersistence.test.ts`
- Current implementation: `src/hooks/useDownloadManager.tsx`

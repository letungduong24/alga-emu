/**
 * AsyncStorage Persistence Layer Test
 * 
 * This test verifies that AsyncStorage is properly configured and can
 * read/write to the 'alga_downloaded_games' key.
 * 
 * Requirements: 3.5, 3.6, 4.5
 */

import { ApiGame } from '@/hooks/useGameApi';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DOWNLOADED_GAMES_KEY = 'alga_downloaded_games';

/**
 * Test: Write and read games to AsyncStorage
 */
export async function testAsyncStorageReadWrite(): Promise<void> {
  console.log('🧪 Testing AsyncStorage read/write operations...');

  // Test data: sample games
  const testGames: ApiGame[] = [
    {
      id: 1,
      name: 'Pokemon FireRed',
      platform: 'gba',
      downloadUrl: 'https://example.com/pokemon_firered.zip',
      filename: 'pokemon_firered.zip',
      size: 16777216, // 16 MB
    },
    {
      id: 2,
      name: 'Mario Kart DS',
      platform: 'nds',
      downloadUrl: 'https://example.com/mario_kart_ds.zip',
      filename: 'mario_kart_ds.zip',
      size: 33554432, // 32 MB
    },
    {
      id: 3,
      name: 'The Legend of Zelda: Ocarina of Time 3D',
      platform: '3ds',
      downloadUrl: 'https://example.com/zelda_oot3d.zip',
      filename: 'zelda_oot3d.zip',
      size: 536870912, // 512 MB
    },
  ];

  try {
    // Step 1: Clear any existing data
    console.log('  ✓ Clearing existing data...');
    await AsyncStorage.removeItem(DOWNLOADED_GAMES_KEY);

    // Step 2: Write test games to AsyncStorage
    console.log('  ✓ Writing test games to AsyncStorage...');
    await AsyncStorage.setItem(DOWNLOADED_GAMES_KEY, JSON.stringify(testGames));

    // Step 3: Read back from AsyncStorage
    console.log('  ✓ Reading games from AsyncStorage...');
    const rawData = await AsyncStorage.getItem(DOWNLOADED_GAMES_KEY);

    if (!rawData) {
      throw new Error('Failed to read data from AsyncStorage');
    }

    // Step 4: Parse and validate
    const parsedGames: ApiGame[] = JSON.parse(rawData);
    console.log('  ✓ Parsed games:', parsedGames.length);

    // Step 5: Verify data integrity
    if (parsedGames.length !== testGames.length) {
      throw new Error(
        `Data mismatch: expected ${testGames.length} games, got ${parsedGames.length}`
      );
    }

    for (let i = 0; i < testGames.length; i++) {
      const original = testGames[i];
      const parsed = parsedGames[i];

      if (
        original.id !== parsed.id ||
        original.name !== parsed.name ||
        original.platform !== parsed.platform ||
        original.downloadUrl !== parsed.downloadUrl ||
        original.filename !== parsed.filename ||
        original.size !== parsed.size
      ) {
        throw new Error(`Data mismatch at index ${i}`);
      }
    }

    console.log('  ✓ Data integrity verified');

    // Step 6: Test empty array
    console.log('  ✓ Testing empty array...');
    await AsyncStorage.setItem(DOWNLOADED_GAMES_KEY, JSON.stringify([]));
    const emptyData = await AsyncStorage.getItem(DOWNLOADED_GAMES_KEY);
    const emptyGames: ApiGame[] = JSON.parse(emptyData || '[]');

    if (emptyGames.length !== 0) {
      throw new Error('Empty array test failed');
    }

    console.log('  ✓ Empty array test passed');

    // Step 7: Test null/missing key
    console.log('  ✓ Testing missing key...');
    await AsyncStorage.removeItem(DOWNLOADED_GAMES_KEY);
    const missingData = await AsyncStorage.getItem(DOWNLOADED_GAMES_KEY);

    if (missingData !== null) {
      throw new Error('Missing key test failed');
    }

    console.log('  ✓ Missing key test passed');

    // Cleanup: restore test data for demonstration
    await AsyncStorage.setItem(DOWNLOADED_GAMES_KEY, JSON.stringify(testGames));

    console.log('✅ All AsyncStorage tests passed!');
    console.log(`   Verified read/write operations for key: "${DOWNLOADED_GAMES_KEY}"`);
  } catch (error) {
    console.error('❌ AsyncStorage test failed:', error);
    throw error;
  }
}

/**
 * Test: Verify ApiGame interface structure
 */
export function testApiGameInterface(): void {
  console.log('🧪 Testing ApiGame interface structure...');

  const sampleGame: ApiGame = {
    id: 999,
    name: 'Test Game',
    platform: 'gba',
    downloadUrl: 'https://example.com/test.zip',
    filename: 'test.zip',
    size: 1024,
  };

  // Verify all required fields exist
  const requiredFields: (keyof ApiGame)[] = [
    'id',
    'name',
    'platform',
    'downloadUrl',
    'filename',
    'size',
  ];

  for (const field of requiredFields) {
    if (!(field in sampleGame)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  console.log('✅ ApiGame interface structure verified!');
  console.log('   Required fields:', requiredFields.join(', '));
}

/**
 * Run all tests
 */
export async function runAllTests(): Promise<void> {
  console.log('🚀 Starting AsyncStorage Persistence Layer Tests\n');

  try {
    testApiGameInterface();
    console.log('');
    await testAsyncStorageReadWrite();
    console.log('\n✅ All tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    throw error;
  }
}

// Export for use in other modules
export { DOWNLOADED_GAMES_KEY };

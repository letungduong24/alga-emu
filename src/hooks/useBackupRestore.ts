import { DownloadState } from '@/hooks/useDownloadManager';
import { ApiGame } from '@/hooks/useGameApi';
import {
    BackupInfo,
    BackupManifest,
    BackupRestoreState,
    RestoreError,
    RestoreResult,
    STORAGE_KEYS
} from '@/types/backup';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useState } from 'react';
import * as AppLauncherModule from '../../modules/app-launcher';

/**
 * useBackupRestore Hook
 * 
 * Orchestrates backup and restore operations, manages state, and coordinates
 * between UI and native module.
 * 
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**
 * 
 * This hook provides:
 * - State management for backup/restore operations
 * - Progress tracking and error handling
 * - Coordination between TypeScript and Kotlin native module
 * - Sequential game download during restore
 */
export const useBackupRestore = () => {
  // === State Management ===
  
  /**
   * isBackingUp: Tracks whether a backup operation is currently in progress
   * **Validates: Requirement 8.1** - Progress reporting during backup
   */
  const [isBackingUp, setIsBackingUp] = useState<boolean>(false);

  /**
   * isRestoring: Tracks whether a restore operation is currently in progress
   * **Validates: Requirement 8.2** - Progress reporting during restore
   */
  const [isRestoring, setIsRestoring] = useState<boolean>(false);

  /**
   * progress: Current operation progress from 0 to 1
   * **Validates: Requirement 8.3** - Progress percentage tracking
   */
  const [progress, setProgress] = useState<number>(0);

  /**
   * currentOperation: Human-readable message describing current operation
   * Example: "Downloading 3/10: Pokemon FireRed"
   * **Validates: Requirement 8.4** - Current operation status message
   */
  const [currentOperation, setCurrentOperation] = useState<string>('');

  /**
   * backupList: List of available backup files with metadata
   * **Validates: Requirement 8.5** - Backup history management
   */
  const [backupList, setBackupList] = useState<BackupInfo[]>([]);

  /**
   * error: Error message if an operation fails, null otherwise
   */
  const [error, setError] = useState<string | null>(null);

  // === Computed State ===
  
  /**
   * Aggregate state object for easy consumption by UI components
   */
  const state: BackupRestoreState = {
    isBackingUp,
    isRestoring,
    progress,
    currentOperation,
    backupList,
    error,
  };

  // === State Update Helpers ===

  /**
   * Reset all state to initial values
   */
  const resetState = useCallback(() => {
    setIsBackingUp(false);
    setIsRestoring(false);
    setProgress(0);
    setCurrentOperation('');
    setError(null);
  }, []);

  /**
   * Update progress and operation message
   */
  const updateProgress = useCallback((newProgress: number, message: string) => {
    setProgress(newProgress);
    setCurrentOperation(message);
  }, []);

  /**
   * Set error state and reset operation flags
   */
  const setErrorState = useCallback((errorMessage: string) => {
    setError(errorMessage);
    setIsBackingUp(false);
    setIsRestoring(false);
    setProgress(0);
    setCurrentOperation('');
  }, []);

  // === Public API (to be implemented in subsequent tasks) ===

  /**
   * Create a new backup
   * 
   * @param includeCovers - Whether to include cover images in the backup
   * @returns Promise with backup file path and size
   * 
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 6.1, 6.2**
   */
  const createBackup = useCallback(async (includeCovers: boolean): Promise<{
    filePath: string;
    fileSize: number;
  }> => {
    try {
      // Reset error state and set backing up flag
      setError(null);
      setIsBackingUp(true);
      setProgress(0);
      setCurrentOperation('Reading games list...');

      // Read games list from AsyncStorage
      const gamesJson = await AsyncStorage.getItem(STORAGE_KEYS.DOWNLOADED_GAMES);
      
      if (!gamesJson) {
        throw new Error('No games found in storage. Cannot create backup.');
      }

      // Update progress
      setProgress(0.2);
      setCurrentOperation('Creating backup archive...');

      // Call native module to create backup
      const result = await AppLauncherModule.createBackup(includeCovers, gamesJson);

      // Update progress to complete
      setProgress(1);
      setCurrentOperation('Backup created successfully');

      // Reset state after a brief delay
      setTimeout(() => {
        resetState();
      }, 1000);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred during backup';
      setErrorState(errorMessage);
      throw error;
    }
  }, [resetState, setErrorState]);

  /**
   * Restore from a backup file
   * 
   * @param backupFilePath - Full path to the backup ZIP file
   * @param downloadManager - Download manager instance with startDownload and downloads Map
   * @param onProgress - Optional callback for progress updates
   * @returns Promise with restore result summary
   * 
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 4.1, 4.2, 4.3, 4.4, 4.5, 8.2, 8.3, 9.1, 9.2, 9.3, 9.4, 9.5**
   */
  const restoreBackup = useCallback(async (
    backupFilePath: string,
    downloadManager: {
      startDownload: (game: ApiGame, romDir: string, romExtensions: string[]) => void;
      downloads: Map<number, DownloadState>;
      downloadedGameIds: Set<number>;
    },
    onProgress?: (progress: number, message: string) => void
  ): Promise<RestoreResult> => {
    try {
      // Reset error state and set restoring flag
      setError(null);
      setIsRestoring(true);
      setProgress(0);
      setCurrentOperation('Validating backup file...');

      // Call native module to extract saves and manifest
      const nativeResult = await AppLauncherModule.restoreBackup(backupFilePath);
      
      // Parse the manifest
      const manifest: BackupManifest = JSON.parse(nativeResult.manifest);
      
      // Update progress
      const progressUpdate = (prog: number, msg: string) => {
        setProgress(prog);
        setCurrentOperation(msg);
        if (onProgress) {
          onProgress(prog, msg);
        }
      };

      progressUpdate(0.1, `Restored ${nativeResult.savesRestored} saves`);

      // Read current downloaded games from AsyncStorage
      const currentGamesJson = await AsyncStorage.getItem(STORAGE_KEYS.DOWNLOADED_GAMES);
      const currentGames: ApiGame[] = currentGamesJson ? JSON.parse(currentGamesJson) : [];
      const currentGameIds = new Set(currentGames.map(g => g.id));

      // Also check downloadedGameIds from download manager (in-memory state)
      const allDownloadedIds = new Set([...currentGameIds, ...downloadManager.downloadedGameIds]);

      // Filter games that need to be downloaded (not already on device)
      // Check both AsyncStorage AND physical ROM files on disk
      const gamesNeedingDownload: typeof manifest.games = [];
      
      for (const game of manifest.games) {
        // Skip if already in AsyncStorage or download manager
        if (allDownloadedIds.has(game.id)) {
          continue;
        }
        
        // Check if ROM file exists on disk (in case AsyncStorage was cleared but files remain)
        const platformConfig = getPlatformConfig(game.platform);
        
        // We need to fetch game from API to get filename for checking
        try {
          const { fetchGameById } = await import('@/hooks/useGameApi');
          const apiGame = await fetchGameById(game.id);
          
          if (apiGame) {
            const romDir = `${platformConfig.baseDir}/${apiGame.filename.replace(/\.zip$/i, '')}`;
            const romExists = await AppLauncherModule.fileExists(romDir);
            
            if (romExists) {
              // ROM exists on disk, skip download
              console.log(`ROM already exists for ${game.name}, skipping download`);
              continue;
            }
          }
        } catch (error) {
          console.warn(`Could not check ROM existence for ${game.name}:`, error);
        }
        
        // Game needs to be downloaded
        gamesNeedingDownload.push(game);
      }

      // Initialize result counters
      let gamesDownloaded = 0;
      let gamesFailed = 0;
      const errors: RestoreError[] = [];

      // If no games to download, return early
      if (gamesNeedingDownload.length === 0) {
        progressUpdate(1, 'Restore complete - all games already downloaded');
        
        setTimeout(() => {
          resetState();
        }, 1000);

        return {
          gamesDownloaded: 0,
          gamesFailed: 0,
          savesRestored: nativeResult.savesRestored,
          coversRestored: nativeResult.coversRestored,
          errors: [],
        };
      }

      // Sequential download: download games one at a time
      const totalGames = gamesNeedingDownload.length;
      
      for (let i = 0; i < gamesNeedingDownload.length; i++) {
        const gameMetadata = gamesNeedingDownload[i];
        const gameIndex = i + 1;

        // Update progress message
        progressUpdate(
          0.1 + (i / totalGames) * 0.9,
          `Fetching ${gameIndex}/${totalGames}: ${gameMetadata.name}`
        );

        try {
          // Fetch game details from API to get fresh downloadUrl
          const { fetchGameById } = await import('@/hooks/useGameApi');
          const apiGame = await fetchGameById(gameMetadata.id);
          
          if (!apiGame) {
            throw new Error('Game not found in API');
          }
          
          // Validate downloadUrl
          if (!apiGame.downloadUrl || 
              (!apiGame.downloadUrl.startsWith('http://') && !apiGame.downloadUrl.startsWith('https://'))) {
            throw new Error('Invalid download URL from API');
          }

          // Update progress message
          progressUpdate(
            0.1 + (i / totalGames) * 0.9,
            `Downloading ${gameIndex}/${totalGames}: ${gameMetadata.name}`
          );

          // Determine ROM directory and extensions based on platform
          const platformConfig = getPlatformConfig(gameMetadata.platform);
          const romDir = `${platformConfig.baseDir}/${apiGame.filename.replace(/\.zip$/i, '')}`;

          // Start the download
          downloadManager.startDownload(apiGame, romDir, platformConfig.romExtensions);

          // Wait for download to complete
          const downloadSuccess = await waitForDownloadComplete(
            gameMetadata.id,
            downloadManager.downloads,
            (prog) => {
              // Update progress with download percentage
              const overallProgress = 0.1 + (i / totalGames) * 0.9 + (prog / totalGames) * 0.9;
              progressUpdate(
                overallProgress,
                `Downloading ${gameIndex}/${totalGames}: ${gameMetadata.name} (${Math.round(prog * 100)}%)`
              );
            }
          );

          if (downloadSuccess) {
            gamesDownloaded++;
          } else {
            // Download failed
            gamesFailed++;
            const downloadState = downloadManager.downloads.get(gameMetadata.id);
            const errorMsg = downloadState?.error || 'Download failed';
            errors.push({
              gameId: gameMetadata.id,
              gameName: gameMetadata.name,
              error: errorMsg,
            });
            console.error(`Failed to download game ${gameMetadata.name}: ${errorMsg}`);
          }
        } catch (error) {
          // Unexpected error during download
          gamesFailed++;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push({
            gameId: gameMetadata.id,
            gameName: gameMetadata.name,
            error: errorMsg,
          });
          console.error(`Error downloading game ${gameMetadata.name}:`, error);
        }
      }

      // Final progress update
      progressUpdate(1, `Restore complete: ${gamesDownloaded} downloaded, ${gamesFailed} failed`);

      // Reset state after a brief delay
      setTimeout(() => {
        resetState();
      }, 2000);

      return {
        gamesDownloaded,
        gamesFailed,
        savesRestored: nativeResult.savesRestored,
        coversRestored: nativeResult.coversRestored,
        errors,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred during restore';
      setErrorState(errorMessage);
      throw error;
    }
  }, [resetState, setErrorState]);

  /**
   * Helper function to get platform-specific configuration
   */
  const getPlatformConfig = (platform: string): { baseDir: string; romExtensions: string[] } => {
    const EXTERNAL_ROM_DIR = '/storage/emulated/0/Alga/roms';
    
    const configs: Record<string, { emulatorId: string; romExtensions: string[] }> = {
      'gba': { emulatorId: 'mgba', romExtensions: ['.gba'] },
      'nds': { emulatorId: 'melonds', romExtensions: ['.nds'] },
      '3ds': { emulatorId: 'citra', romExtensions: ['.3ds', '.3dsx', '.cci', '.cxi'] },
    };

    const config = configs[platform] || configs['nds']; // Default to NDS
    return {
      baseDir: `${EXTERNAL_ROM_DIR}/${config.emulatorId}`,
      romExtensions: config.romExtensions,
    };
  };

  /**
   * Helper function to wait for a download to complete
   * 
   * @param gameId - ID of the game being downloaded
   * @param downloads - Map of download states
   * @param onProgress - Callback for progress updates
   * @returns Promise that resolves to true if download succeeded, false if failed
   */
  const waitForDownloadComplete = (
    gameId: number,
    downloads: Map<number, DownloadState>,
    onProgress?: (progress: number) => void
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const downloadState = downloads.get(gameId);
        
        if (!downloadState) {
          // Download not started yet, keep waiting
          return;
        }

        // Update progress if callback provided
        if (onProgress && downloadState.progress > 0) {
          onProgress(downloadState.progress);
        }

        // Check if download is complete
        if (downloadState.status === 'done') {
          clearInterval(checkInterval);
          resolve(true);
        } else if (downloadState.status === 'error') {
          clearInterval(checkInterval);
          resolve(false);
        }
        // Otherwise, keep polling
      }, 500); // Poll every 500ms

      // Timeout after 30 minutes (very long downloads)
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(false);
      }, 30 * 60 * 1000);
    });
  };

  /**
   * List all available backups
   * 
   * @returns Promise with array of backup metadata
   * 
   * **Validates: Requirements 5.1, 5.2**
   */
  const listBackups = useCallback(async (): Promise<BackupInfo[]> => {
    try {
      // Call native module to list backups
      const backups = await AppLauncherModule.listBackups();
      
      // Update state with backup list
      setBackupList(backups);
      
      return backups;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to list backups';
      console.error('Error listing backups:', errorMessage);
      setError(errorMessage);
      return [];
    }
  }, []);

  /**
   * Delete a specific backup file
   * 
   * @param backupFilePath - Full path to the backup ZIP file to delete
   * @returns Promise with success boolean
   * 
   * **Validates: Requirements 5.3, 5.4**
   */
  const deleteBackup = useCallback(async (backupFilePath: string): Promise<boolean> => {
    try {
      // Call native module to delete backup
      const success = await AppLauncherModule.deleteBackup(backupFilePath);
      
      if (success) {
        // Refresh backup list after deletion
        await listBackups();
      }
      
      return success;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete backup';
      console.error('Error deleting backup:', errorMessage);
      setError(errorMessage);
      return false;
    }
  }, [listBackups]);

  // === Return Hook Interface ===

  return {
    // State
    state,
    isBackingUp,
    isRestoring,
    progress,
    currentOperation,
    backupList,
    error,

    // Actions
    createBackup,
    restoreBackup,
    listBackups,
    deleteBackup,

    // Helpers
    resetState,
    updateProgress,
  };
};

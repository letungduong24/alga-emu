import { DownloadState } from '@/hooks/useDownloadManager';
import { useBackupRestoreStore } from '@/stores/backupRestoreStore';
import {
  BackupInfo,
  BackupRestoreState,
  RestoreResult
} from '@/types/backup';
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
  // === Global State from Zustand ===
  const {
    isBackingUp,
    isRestoring,
    progress,
    currentOperation,
    error,
    setIsBackingUp,
    setIsRestoring,
    setProgress,
    setCurrentOperation,
    setError,
    updateProgress,
    resetState,
  } = useBackupRestoreStore();

  /**
   * backupList: List of available backup files with metadata
   * **Validates: Requirement 8.5** - Backup history management
   */
  const [backupList, setBackupList] = useState<BackupInfo[]>([]);

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
   * Set error state and reset operation flags
   */
  const setErrorState = useCallback((errorMessage: string) => {
    setError(errorMessage);
    setIsBackingUp(false);
    setIsRestoring(false);
    setProgress(0);
    setCurrentOperation('');
  }, [setError, setIsBackingUp, setIsRestoring, setProgress, setCurrentOperation]);

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
      setCurrentOperation('Creating save backup...');

      // Update progress
      setProgress(0.5);
      setCurrentOperation('Creating backup archive...');

      // Call native module to create backup (saves only, no games)
      const result = await AppLauncherModule.createBackup(includeCovers, '[]');

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
  }, [resetState, setErrorState, setError, setIsBackingUp, setProgress, setCurrentOperation]);

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
    onProgress?: (progress: number, message: string) => void
  ): Promise<RestoreResult> => {
    try {
      // Reset error state and set restoring flag
      setError(null);
      setIsRestoring(true);
      setProgress(0);
      setCurrentOperation('Validating backup file...');

      // Call native module to extract saves only (no game downloads)
      const nativeResult = await AppLauncherModule.restoreBackup(backupFilePath);
      
      // Update progress
      const progressUpdate = (prog: number, msg: string) => {
        setProgress(prog);
        setCurrentOperation(msg);
        if (onProgress) {
          onProgress(prog, msg);
        }
      };

      progressUpdate(0.5, `Restored ${nativeResult.savesRestored} saves`);

      // Final progress update
      progressUpdate(1, `Restore complete: ${nativeResult.savesRestored} saves restored`);

      // Reset state after a brief delay
      setTimeout(() => {
        console.log('Resetting restore state after completion');
        resetState();
      }, 2000);

      return {
        gamesDownloaded: 0,
        gamesFailed: 0,
        savesRestored: nativeResult.savesRestored,
        coversRestored: nativeResult.coversRestored,
        errors: [],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred during restore';
      setErrorState(errorMessage);
      throw error;
    }
  }, [resetState, setErrorState, setError, setIsRestoring, setProgress, setCurrentOperation]);

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

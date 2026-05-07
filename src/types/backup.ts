/**
 * Type definitions for Backup/Restore System
 * 
 * This file contains all TypeScript interfaces and types used in the
 * backup and restore functionality.
 */

import { ApiGame } from '@/hooks/useGameApi';

/**
 * Backup Manifest Structure
 * 
 * The manifest is stored as manifest.json at the root of the backup ZIP.
 * It contains metadata about the backup and all games included.
 */
export interface BackupManifest {
  version: string;              // Backup format version (currently "1.0")
  createdAt: string;            // ISO 8601 timestamp of backup creation
  games: GameMetadata[];        // Array of game metadata
  saveFiles: string[];          // Relative paths of save files in backup
  coverFiles?: string[];        // Optional: relative paths of cover images
}

/**
 * Game Metadata
 * 
 * Metadata for a single game in the backup manifest.
 * This is a subset of ApiGame with essential fields for restore.
 */
export interface GameMetadata {
  id: number;                   // Unique game identifier
  name: string;                 // Game name
  platform: string;             // Platform: 'gba', 'nds', '3ds'
  downloadUrl: string;          // URL to download the game
  filename: string;             // Filename (e.g., 'pokemon_firered.zip')
}

/**
 * Native Restore Result
 * 
 * Result returned by the Kotlin native module's restoreBackup function.
 * This only includes the native restore operations (saves and covers).
 */
export interface NativeRestoreResult {
  manifest: string;             // JSON string of the backup manifest
  savesRestored: number;        // Number of save files restored
  coversRestored: number;       // Number of cover images restored
}

/**
 * Restore Result
 * 
 * Complete summary of a restore operation, including success/failure counts
 * and any errors encountered. This is the final result after both native
 * restore and sequential game downloads are complete.
 */
export interface RestoreResult {
  gamesDownloaded: number;      // Number of games successfully downloaded
  gamesFailed: number;          // Number of games that failed to download
  savesRestored: number;        // Number of save files restored
  coversRestored: number;       // Number of cover images restored
  errors: RestoreError[];       // Array of errors encountered
}

/**
 * Restore Error
 * 
 * Details about a specific error during restore.
 */
export interface RestoreError {
  gameId: number;               // ID of the game that failed
  gameName: string;             // Name of the game that failed
  error: string;                // Error message
}

/**
 * Backup Info
 * 
 * Metadata about a backup file, used for displaying backup history.
 */
export interface BackupInfo {
  filePath: string;             // Full path to backup file
  fileName: string;             // Backup filename
  createdAt: string;            // ISO 8601 timestamp
  fileSize: number;             // File size in bytes
  gameCount: number;            // Number of games in backup
}

/**
 * Backup/Restore State
 * 
 * State management for backup and restore operations.
 */
export interface BackupRestoreState {
  isBackingUp: boolean;         // True if backup is in progress
  isRestoring: boolean;         // True if restore is in progress
  progress: number;             // Progress from 0 to 1
  currentOperation: string;     // Current operation message
  backupList: BackupInfo[];     // List of available backups
  error: string | null;         // Error message if operation failed
}

/**
 * AsyncStorage Key Constants
 */
export const STORAGE_KEYS = {
  DOWNLOADED_GAMES: 'alga_downloaded_games',
} as const;

/**
 * Type guard to check if an object is a valid ApiGame
 */
export function isApiGame(obj: any): obj is ApiGame {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'number' &&
    typeof obj.name === 'string' &&
    typeof obj.platform === 'string' &&
    typeof obj.downloadUrl === 'string' &&
    typeof obj.filename === 'string' &&
    typeof obj.size === 'number'
  );
}

/**
 * Type guard to check if an object is a valid BackupManifest
 */
export function isBackupManifest(obj: any): obj is BackupManifest {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.version === 'string' &&
    typeof obj.createdAt === 'string' &&
    Array.isArray(obj.games) &&
    Array.isArray(obj.saveFiles)
  );
}

/**
 * Helper function to format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Helper function to format timestamp for display
 */
export function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString();
}

/**
 * Native Module Interface
 * 
 * Type definitions for the Kotlin AppLauncherModule functions.
 * These match the exact signatures of the native module.
 */
export interface AppLauncherBackupModule {
  /**
   * Create a backup ZIP file
   * @param includeCovers - Whether to include cover images in the backup
   * @param gamesJson - JSON string of the games array
   * @returns Object with filePath and fileSize
   */
  createBackup(includeCovers: boolean, gamesJson: string): Promise<{
    filePath: string;
    fileSize: number;
  }>;

  /**
   * Restore a backup ZIP file
   * @param backupFilePath - Full path to the backup ZIP file
   * @returns Object with manifest JSON string, savesRestored count, and coversRestored count
   */
  restoreBackup(backupFilePath: string): Promise<NativeRestoreResult>;

  /**
   * List all available backup files
   * @returns Array of backup metadata
   */
  listBackups(): Promise<BackupInfo[]>;

  /**
   * Delete a specific backup file
   * @param backupFilePath - Full path to the backup ZIP file to delete
   * @returns True if deletion was successful, false otherwise
   */
  deleteBackup(backupFilePath: string): Promise<boolean>;
}

// Re-export ApiGame for convenience
export type { ApiGame };

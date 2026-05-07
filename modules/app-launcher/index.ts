import { requireNativeModule } from 'expo-modules-core';

const AppLauncherModule = requireNativeModule('AppLauncher');

export async function createDirectory(path: string): Promise<boolean> {
  return AppLauncherModule.createDirectory(path);
}

export async function fileExists(path: string): Promise<boolean> {
  return AppLauncherModule.fileExists(path);
}

export async function listFiles(dirPath: string): Promise<string[]> {
  return AppLauncherModule.listFiles(dirPath);
}

export async function isAppInstalled(packageName: string): Promise<boolean> {
  return AppLauncherModule.isAppInstalled(packageName);
}

export async function launchApp(packageName: string): Promise<void> {
  return AppLauncherModule.launchApp(packageName);
}

export async function launchGame(corePath: string, romPath: string): Promise<void> {
  return AppLauncherModule.launchGame(corePath, romPath);
}

export async function copyFile(srcPath: string, destPath: string): Promise<string> {
  return AppLauncherModule.copyFile(srcPath, destPath);
}

export async function deleteFileOrDir(path: string): Promise<boolean> {
  return AppLauncherModule.deleteFileOrDir(path);
}

// === Background Download (Android DownloadManager) ===
export interface EnqueueResult {
  downloadId: string;
  filePath: string;
}

export async function enqueueDownload(
  url: string,
  destSubPath: string,
  title: string,
  description: string
): Promise<EnqueueResult> {
  return AppLauncherModule.enqueueDownload(url, destSubPath, title, description);
}

export interface DownloadProgress {
  bytesDownloaded: number;
  bytesTotal: number;
  status: 'pending' | 'running' | 'paused' | 'success' | 'failed' | 'not_found' | 'unknown';
  reason: number;
  progress: number;
}

export async function getDownloadProgress(downloadId: string): Promise<DownloadProgress> {
  return AppLauncherModule.getDownloadProgress(downloadId);
}

export async function cancelNativeDownload(downloadId: string): Promise<boolean> {
  return AppLauncherModule.cancelNativeDownload(downloadId);
}

// === Save Management ===
export async function exportSave(romBaseName: string, coreId: string): Promise<string> {
  return AppLauncherModule.exportSave(romBaseName, coreId);
}

export async function importSave(romBaseName: string, sourceUri: string, coreId: string): Promise<string> {
  return AppLauncherModule.importSave(romBaseName, sourceUri, coreId);
}

export async function hasSave(romBaseName: string, coreId: string): Promise<boolean> {
  return AppLauncherModule.hasSave(romBaseName, coreId);
}

export async function hasExternalSave(romBaseName: string): Promise<boolean> {
  return AppLauncherModule.hasExternalSave(romBaseName);
}

// === Storage Permission (Android 11+) ===
export async function checkStoragePermission(): Promise<boolean> {
  return AppLauncherModule.checkStoragePermission();
}

export async function requestStoragePermission(): Promise<boolean> {
  return AppLauncherModule.requestStoragePermission();
}

// === NDS ROM Icon Extraction ===
export async function extractNdsIcon(romPath: string, outputPngPath: string): Promise<boolean> {
  return AppLauncherModule.extractNdsIcon(romPath, outputPngPath);
}

// === 3DS ROM Icon Extraction ===
export async function extract3dsIcon(romPath: string, outputPngPath: string): Promise<boolean> {
  return AppLauncherModule.extract3dsIcon(romPath, outputPngPath);
}

// === Backup/Restore System ===

/**
 * Create a backup ZIP file containing game metadata, save files, and optionally cover images.
 * 
 * @param includeCovers - Whether to include cover images in the backup
 * @param gamesJson - JSON string of the games array from AsyncStorage
 * @returns Promise resolving to an object with filePath (string) and fileSize (number)
 * 
 * @example
 * const result = await createBackup(true, JSON.stringify(games));
 * console.log(`Backup created at ${result.filePath}, size: ${result.fileSize} bytes`);
 */
export async function createBackup(
  includeCovers: boolean,
  gamesJson: string
): Promise<{ filePath: string; fileSize: number }> {
  return AppLauncherModule.createBackup(includeCovers, gamesJson);
}

/**
 * Restore a backup ZIP file, extracting save files and cover images.
 * 
 * @param backupFilePath - Full path to the backup ZIP file
 * @returns Promise resolving to an object with:
 *   - manifest: JSON string of the backup manifest
 *   - savesRestored: number of save files restored
 *   - coversRestored: number of cover images restored
 * 
 * @example
 * const result = await restoreBackup('/storage/emulated/0/Alga/backups/alga_backup_20240101_120000.zip');
 * const manifest = JSON.parse(result.manifest);
 * console.log(`Restored ${result.savesRestored} saves and ${result.coversRestored} covers`);
 */
export async function restoreBackup(backupFilePath: string): Promise<{
  manifest: string;
  savesRestored: number;
  coversRestored: number;
}> {
  return AppLauncherModule.restoreBackup(backupFilePath);
}

/**
 * List all available backup files in the backup storage directory.
 * 
 * @returns Promise resolving to an array of backup metadata objects, each containing:
 *   - filePath: full path to the backup file
 *   - fileName: backup filename
 *   - createdAt: ISO 8601 timestamp
 *   - fileSize: file size in bytes
 *   - gameCount: number of games in the backup
 * 
 * @example
 * const backups = await listBackups();
 * backups.forEach(backup => {
 *   console.log(`${backup.fileName}: ${backup.gameCount} games, ${backup.fileSize} bytes`);
 * });
 */
export async function listBackups(): Promise<Array<{
  filePath: string;
  fileName: string;
  createdAt: string;
  fileSize: number;
  gameCount: number;
}>> {
  return AppLauncherModule.listBackups();
}

/**
 * Delete a specific backup file from storage.
 * 
 * @param backupFilePath - Full path to the backup ZIP file to delete
 * @returns Promise resolving to true if deletion was successful, false otherwise
 * 
 * @example
 * const success = await deleteBackup('/storage/emulated/0/Alga/backups/alga_backup_20240101_120000.zip');
 * if (success) {
 *   console.log('Backup deleted successfully');
 * }
 */
export async function deleteBackup(backupFilePath: string): Promise<boolean> {
  return AppLauncherModule.deleteBackup(backupFilePath);
}

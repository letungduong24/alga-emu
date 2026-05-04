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

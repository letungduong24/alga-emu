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

export async function launchRetroArch(
  packageName: string,
  activityName: string,
  romPath: string,
  corePath: string
): Promise<void> {
  return AppLauncherModule.launchRetroArch(packageName, activityName, romPath, corePath);
}

export async function launchAppWithFile(packageName: string, filePath: string): Promise<void> {
  return AppLauncherModule.launchAppWithFile(packageName, filePath);
}

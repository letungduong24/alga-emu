import { useState, useEffect, useCallback } from 'react';
import { Platform, AppState, AppStateStatus, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { isAppInstalled, createDirectory, fileExists } from '../../modules/app-launcher';
import { RETROARCH } from '@/constants/emulators';
import { unzip } from 'react-native-zip-archive';

const CORE_DIR = '/storage/emulated/0/Alga/cores';

export const useRetroArch = () => {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  const checkInstallation = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    try {
      const installed = await isAppInstalled(RETROARCH.packageName);
      console.log(`[Alga] RetroArch installed: ${installed}`);
      setIsInstalled(installed);
    } catch (e) {
      setIsInstalled(false);
    }
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        setTimeout(() => checkInstallation(), 500);
      }
    });
    checkInstallation();
    return () => subscription.remove();
  }, [checkInstallation]);

  // Tải và cài đặt RetroArch
  const downloadAndInstall = async () => {
    if (isDownloading) return;

    const fileUri = `${FileSystem.cacheDirectory}retroarch.apk`;
    const fileInfo = await FileSystem.getInfoAsync(fileUri);

    if (fileInfo.exists) {
      await openInstaller(fileUri);
      return;
    }

    try {
      setIsDownloading(true);
      setProgress(0);

      const downloadResumable = FileSystem.createDownloadResumable(
        RETROARCH.apkUrl,
        fileUri,
        {},
        (dp) => setProgress(dp.totalBytesWritten / dp.totalBytesExpectedToWrite)
      );

      const result = await downloadResumable.downloadAsync();
      if (result) {
        await openInstaller(result.uri);
      }
    } catch (error) {
      console.error('[Alga] Lỗi tải RetroArch:', error);
      Alert.alert('Lỗi', 'Không thể tải RetroArch.');
    } finally {
      setIsDownloading(false);
      setProgress(0);
    }
  };

  const openInstaller = async (uri: string) => {
    try {
      const contentUri = await FileSystem.getContentUriAsync(uri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1,
        type: 'application/vnd.android.package-archive',
      });
    } catch (error) {
      console.error('[Alga] Lỗi mở installer:', error);
    }
  };

  // Mở RetroArch 1 lần để khởi tạo + cấp quyền storage
  const initRetroArch = async () => {
    try {
      const { launchApp } = require('../../modules/app-launcher');
      await launchApp(RETROARCH.packageName);
    } catch (error) {
      console.error('[Alga] Lỗi mở RetroArch:', error);
    }
  };

  return { isInstalled, isDownloading, progress, downloadAndInstall, checkInstallation, initRetroArch };
};

// Hook quản lý core cho từng hệ máy
export const useCore = (coreName: string, coreUrl: string) => {
  const [isCoreReady, setIsCoreReady] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  const corePath = `${CORE_DIR}/${coreName}`;

  const checkCore = useCallback(async () => {
    try {
      const exists = await fileExists(corePath);
      console.log(`[Alga] Core ${coreName}: exists=${exists}`);
      setIsCoreReady(exists);
      return exists;
    } catch {
      setIsCoreReady(false);
      return false;
    }
  }, [corePath, coreName]);

  useEffect(() => {
    checkCore();
  }, [checkCore]);

  const downloadCore = async () => {
    if (isDownloading) return;

    try {
      setIsDownloading(true);
      setProgress(0);

      await createDirectory(CORE_DIR);

      // Core files trên buildbot là .zip, cần giải nén
      const zipUri = `${FileSystem.cacheDirectory}${coreName}.zip`;

      const downloadResumable = FileSystem.createDownloadResumable(
        coreUrl,
        zipUri,
        {},
        (dp) => setProgress(dp.totalBytesWritten / dp.totalBytesExpectedToWrite * 0.9)
      );

      const result = await downloadResumable.downloadAsync();

      if (result) {
        setProgress(0.95);
        // Giải nén core .so
        await unzip(result.uri, CORE_DIR);
        await FileSystem.deleteAsync(zipUri, { idempotent: true });

        const exists = await fileExists(corePath);
        if (exists) {
          console.log(`[Alga] Core ready: ${corePath}`);
          setIsCoreReady(true);
          setProgress(1);
        } else {
          Alert.alert('Lỗi', 'Không tìm thấy core sau khi giải nén.');
        }
      }
    } catch (error) {
      console.error('[Alga] Lỗi tải core:', error);
      Alert.alert('Lỗi', `Không thể tải core: ${error}`);
    } finally {
      setIsDownloading(false);
    }
  };

  return { isCoreReady, isDownloading, progress, downloadCore, corePath };
};

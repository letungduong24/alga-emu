import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { createDirectory, fileExists } from '../../modules/app-launcher';
import { unzip } from 'react-native-zip-archive';

const CORE_DIR = '/storage/emulated/0/Alga/cores';

// Hook quản lý core cho từng hệ máy
export const useCore = (coreName: string, coreUrl: string) => {
  const [isCoreReady, setIsCoreReady] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  const corePath = `${CORE_DIR}/${coreName}`;

  const checkCore = useCallback(async () => {
    try {
      const exists = await fileExists(corePath);
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
        await unzip(result.uri, CORE_DIR);
        await FileSystem.deleteAsync(zipUri, { idempotent: true });

        const exists = await fileExists(corePath);
        if (exists) {
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

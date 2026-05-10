import * as FileSystem from 'expo-file-system/legacy';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { unzip } from 'react-native-zip-archive';
import { createDirectory, fileExists } from '../../modules/app-launcher';

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

      // Check if this is a direct .so file (like RPG XP core)
      const isDirectSoFile = coreUrl.endsWith('.so');
      
      if (isDirectSoFile) {
        // Direct .so file - download to cache first, then move
        const tempUri = `${FileSystem.cacheDirectory}${coreName}`;
        
        const downloadResumable = FileSystem.createDownloadResumable(
          coreUrl,
          tempUri,
          {},
          (dp) => setProgress(dp.totalBytesWritten / dp.totalBytesExpectedToWrite * 0.9)
        );

        const result = await downloadResumable.downloadAsync();
        
        if (result) {
          // Move from cache to final location using native copyFile
          const { copyFile } = require('../../modules/app-launcher');
          await copyFile(result.uri.replace('file://', ''), corePath);
          
          // Clean up temp file
          await FileSystem.deleteAsync(tempUri, { idempotent: true });
          
          setProgress(1);
          setIsCoreReady(true);
        }
      } else {
        // ZIP file - download to cache then extract
        const downloadUri = `${FileSystem.cacheDirectory}${coreName}.zip`;
        
        const downloadResumable = FileSystem.createDownloadResumable(
          coreUrl,
          downloadUri,
          {},
          (dp) => setProgress(dp.totalBytesWritten / dp.totalBytesExpectedToWrite * 0.9)
        );

        const result = await downloadResumable.downloadAsync();

        if (result) {
          setProgress(0.95);
          await unzip(result.uri, CORE_DIR);
          await FileSystem.deleteAsync(downloadUri, { idempotent: true });

          const exists = await fileExists(corePath);
          if (exists) {
            setIsCoreReady(true);
            setProgress(1);
          } else {
            Alert.alert('Lỗi', 'Không tìm thấy core sau khi giải nén.');
          }
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

import { useState, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { unzip } from 'react-native-zip-archive';
import { createDirectory, fileExists, listFiles, launchGame, copyFile } from '../../modules/app-launcher';
import { Game } from '@/constants/games';
import { EMULATORS } from '@/constants/emulators';

const EXTERNAL_ROM_DIR = '/storage/emulated/0/Alga/roms';
const CORE_DIR = '/storage/emulated/0/Alga/cores';

export const useGameDownload = (game: Game) => {
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const actualRomPath = useRef<string | null>(null);

  const emulator = EMULATORS.find((e) => e.id === game.emulatorId);
  const romDir = `${EXTERNAL_ROM_DIR}/${game.emulatorId}`;
  const romExtensions = emulator?.romExtension ?? [];

  const findRomFile = async (): Promise<string | null> => {
    try {
      const files = await listFiles(romDir);
      const romFile = files.find((f: string) => {
        const lower = f.toLowerCase();
        return romExtensions.some((ext) => lower.endsWith(ext));
      });
      if (romFile) {
        actualRomPath.current = romFile;
        return romFile;
      }
      return null;
    } catch {
      return null;
    }
  };

  const checkDownloaded = useCallback(async () => {
    try {
      const rom = await findRomFile();
      const exists = rom !== null;
      console.log(`[Alga] Check ROM ${game.id}: exists=${exists}, path=${rom}`);
      setIsDownloaded(exists);
      return exists;
    } catch {
      setIsDownloaded(false);
      return false;
    }
  }, [romDir, game.id]);

  const downloadGame = async () => {
    if (isDownloading) return;

    try {
      setIsDownloading(true);
      setProgress(0);

      await createDirectory(romDir);

      const zipUri = `${FileSystem.cacheDirectory}${game.id}.zip`;

      const downloadResumable = FileSystem.createDownloadResumable(
        game.downloadUrl,
        zipUri,
        {},
        (dp) => setProgress(dp.totalBytesWritten / dp.totalBytesExpectedToWrite * 0.9)
      );

      const result = await downloadResumable.downloadAsync();

      if (result) {
        setProgress(0.95);
        await unzip(result.uri, romDir);
        await FileSystem.deleteAsync(zipUri, { idempotent: true });

        const rom = await findRomFile();
        if (rom) {
          console.log(`[Alga] Game ready: ${rom}`);
          setProgress(1);
          setIsDownloaded(true);
        } else {
          Alert.alert('Lỗi', 'Không tìm thấy file ROM sau khi giải nén.');
        }
      }
    } catch (error) {
      console.error('[Alga] Lỗi tải ROM:', error);
      Alert.alert('Lỗi', `Không thể tải game: ${error}`);
    } finally {
      setIsDownloading(false);
    }
  };

  // === MỞ GAME NGAY TRONG ALGA (LibretroDroid) ===
  const playGame = async () => {
    if (!emulator) return;

    let romFile = actualRomPath.current;
    if (!romFile) {
      romFile = await findRomFile();
    }

    if (!romFile) {
      Alert.alert('Lỗi', 'Không tìm thấy file ROM.');
      setIsDownloaded(false);
      return;
    }

    const externalCorePath = `${CORE_DIR}/${emulator.coreName}`;

    try {
      // Kiểm tra core tồn tại
      const coreReady = await fileExists(externalCorePath);
      if (!coreReady) {
        Alert.alert('Thiếu Core', `Cần tải core ${emulator.coreName} trước.`);
        return;
      }

      // Copy core vào internal storage (dlopen cần exec permission)
      // External storage (FUSE) có noexec → không load được .so
      const docDir = (FileSystem.documentDirectory || '').replace('file://', '');
      const internalCoreDir = `${docDir}cores/`;
      const internalCorePath = `${internalCoreDir}${emulator.coreName}`;

      // Tạo thư mục nếu chưa có
      const dirInfo = await FileSystem.getInfoAsync(`${FileSystem.documentDirectory}cores/`);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}cores/`, { intermediates: true });
      }

      // Copy nếu chưa có
      const coreInfo = await FileSystem.getInfoAsync(`${FileSystem.documentDirectory}cores/${emulator.coreName}`);
      if (!coreInfo.exists) {
        console.log(`[Alga] Copying core to internal: ${internalCorePath}`);
        await copyFile(externalCorePath, internalCorePath);
      }

      console.log(`[Alga] Playing in-app: ROM=${romFile}, CORE=${internalCorePath}`);
      await launchGame(internalCorePath, romFile);
    } catch (error) {
      console.error('[Alga] Lỗi mở game:', error);
      Alert.alert('Lỗi', `Không thể mở game: ${error}`);
    }
  };

  return {
    isDownloaded,
    isDownloading,
    progress,
    downloadGame,
    launchGame: playGame,
    checkDownloaded,
  };
};

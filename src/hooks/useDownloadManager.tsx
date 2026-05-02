import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { AppState, AppStateStatus, ToastAndroid, Platform } from 'react-native';
import { unzip } from 'react-native-zip-archive';
import {
  createDirectory,
  listFiles,
  enqueueDownload,
  getDownloadProgress,
  cancelNativeDownload,
  deleteFileOrDir,
  fileExists,
  DownloadProgress,
  extractNdsIcon,
} from '../../modules/app-launcher';
import * as FileSystem from 'expo-file-system/legacy';
import { useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiGame } from '@/hooks/useGameApi';

// === Types ===
export type DownloadStatus = 'idle' | 'downloading' | 'extracting' | 'done' | 'error' | 'queued';

export interface DownloadState {
  gameId: number;
  gameName: string;
  progress: number;       // 0-1
  status: DownloadStatus;
  speed: number;          // bytes/sec
  retryCount: number;
  error?: string;
  nativeDownloadId?: string;
}

interface DownloadMeta {
  url: string;
  romDir: string;
  romExtensions: string[];
  zipPath: string;
}

interface DownloadManagerContextType {
  downloads: Map<number, DownloadState>;
  downloadedGameIds: Set<number>;
  downloadedGames: ApiGame[];
  startDownload: (game: ApiGame, romDir: string, romExtensions: string[]) => void;
  cancelDownload: (gameId: number) => void;
  retryDownload: (gameId: number) => void;
  deleteGame: (gameId: number, emulatorId: string) => Promise<void>;
  scanDownloaded: (games: { id: number; filename: string }[], emulatorId: string, romExtensions: string[]) => Promise<void>;
  scanLocalLibrary: (emulatorId: string, romExtensions: string[]) => Promise<void>;
  getRomPath: (gameId: number) => string | null;
  getLocalCoverPath: (gameId: number) => string;
  isDownloaded: (gameId: number) => boolean;
}

const DownloadManagerContext = createContext<DownloadManagerContextType | null>(null);

const EXTERNAL_ROM_DIR = '/storage/emulated/0/Alga/roms';
const COVER_DIR = '/storage/emulated/0/Alga/covers';
const POLL_INTERVAL = 800;
const DOWNLOADED_GAMES_KEY = 'alga_downloaded_games';

const THUMB_BASES: Record<string, string> = {
  nds: 'https://raw.githubusercontent.com/libretro-thumbnails/Nintendo_-_Nintendo_DS/master/Named_Boxarts',
  '3ds': 'https://raw.githubusercontent.com/libretro-thumbnails/Nintendo_-_Nintendo_3DS/master/Named_Boxarts',
  gba: 'https://raw.githubusercontent.com/libretro-thumbnails/Nintendo_-_Game_Boy_Advance/master/Named_Boxarts',
};
const REGIONS = ['(USA)', '(Europe)', '(USA) (En,Fr,Es)', '(Europe) (En,Fr,De,Es,It)', '(Japan)', '(USA, Europe)'];

// === Provider ===
export const DownloadManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [downloads, setDownloads] = useState<Map<number, DownloadState>>(new Map());
  const [downloadedGameIds, setDownloadedGameIds] = useState<Set<number>>(new Set());
  const [downloadedGames, setDownloadedGames] = useState<ApiGame[]>([]);
  const romPaths = useRef<Map<number, string>>(new Map());
  const downloadMeta = useRef<Map<number, DownloadMeta>>(new Map());
  const gameMeta = useRef<Map<number, ApiGame>>(new Map());
  const pollTimers = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());
  const speedTracker = useRef<Map<number, { lastBytes: number; lastTime: number }>>(new Map());

  // === Load persisted downloaded games on mount ===
  useEffect(() => {
    const loadPersisted = async () => {
      try {
        const raw = await AsyncStorage.getItem(DOWNLOADED_GAMES_KEY);
        if (raw) {
          const games: ApiGame[] = JSON.parse(raw);
          setDownloadedGames(games);
          const ids = new Set(games.map((g) => g.id));
          setDownloadedGameIds(ids);
        }
      } catch {}
    };
    loadPersisted();
  }, []);

  // === Persist downloaded games ===
  const persistDownloadedGames = useCallback(async (games: ApiGame[]) => {
    try {
      await AsyncStorage.setItem(DOWNLOADED_GAMES_KEY, JSON.stringify(games));
    } catch {}
  }, []);

  // === Add game to downloaded list ===
  const addToDownloaded = useCallback((game: ApiGame) => {
    setDownloadedGames((prev) => {
      if (prev.find((g) => g.id === game.id)) return prev;
      const next = [...prev, game];
      persistDownloadedGames(next);
      return next;
    });
    setDownloadedGameIds((prev) => new Set(prev).add(game.id));
  }, [persistDownloadedGames]);

  // === Cleanup on unmount ===
  useEffect(() => {
    return () => {
      pollTimers.current.forEach((timer) => clearInterval(timer));
    };
  }, []);

  // === AppState: inform when going background ===
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        const activeDownloads = Array.from(downloads.values()).filter(
          (d) => d.status === 'downloading' || d.status === 'extracting'
        );
        if (activeDownloads.length > 0 && Platform.OS === 'android') {
          ToastAndroid.show(
            `📥 ${activeDownloads.length} game đang tải nền — xem trong thông báo`,
            ToastAndroid.LONG
          );
        }
      }
    };

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [downloads]);

  // === Update a single download state ===
  const updateDownload = useCallback((gameId: number, updates: Partial<DownloadState>) => {
    setDownloads((prev) => {
      const next = new Map(prev);
      const current = next.get(gameId);
      if (current) {
        next.set(gameId, { ...current, ...updates });
      }
      return next;
    });
  }, []);

  // === Find ROM file in directory ===
  const findRomFile = useCallback(async (romDir: string, romExtensions: string[]): Promise<string | null> => {
    try {
      const files = await listFiles(romDir);
      const romFile = files.find((f: string) => {
        const lower = f.toLowerCase();
        return romExtensions.some((ext) => lower.endsWith(ext));
      });
      return romFile || null;
    } catch {
      return null;
    }
  }, []);

  // === Stop polling for a game ===
  const stopPolling = useCallback((gameId: number) => {
    const timer = pollTimers.current.get(gameId);
    if (timer) {
      clearInterval(timer);
      pollTimers.current.delete(gameId);
    }
    speedTracker.current.delete(gameId);
  }, []);

  // === Handle download completion (unzip + verify) ===
  const handleDownloadComplete = useCallback(async (gameId: number) => {
    const meta = downloadMeta.current.get(gameId);
    if (!meta) return;

    stopPolling(gameId);

    try {
      updateDownload(gameId, { status: 'extracting', progress: 0.95 });
      await createDirectory(meta.romDir);
      await unzip(meta.zipPath, meta.romDir);

      // Cleanup zip from Downloads folder
      try {
        const RNFS = require('react-native-fs');
        // fallback: just delete via shell or ignore
      } catch {}

      await AsyncStorage.removeItem(`dl_native_${gameId}`);

      const rom = await findRomFile(meta.romDir, meta.romExtensions);
      if (rom) {
        romPaths.current.set(gameId, rom);
        updateDownload(gameId, { status: 'done', progress: 1 });

        // Add to persistent downloaded list + cache cover art
        const game = gameMeta.current.get(gameId);
        if (game) {
          addToDownloaded(game);
          downloadCoverArt(game); // async, non-blocking
        }

        queryClient.invalidateQueries({ queryKey: ['games'] });
      } else {
        throw new Error('Không tìm thấy ROM sau khi giải nén');
      }
    } catch (error: any) {
      updateDownload(gameId, {
        status: 'error',
        error: error.message || 'Lỗi giải nén',
      });
    }
  }, [updateDownload, findRomFile, queryClient, stopPolling, addToDownloaded]);

  // === Start polling download progress ===
  const startPolling = useCallback((gameId: number, nativeId: string) => {
    stopPolling(gameId);
    speedTracker.current.set(gameId, { lastBytes: 0, lastTime: Date.now() });

    const timer = setInterval(async () => {
      try {
        const prog: DownloadProgress = await getDownloadProgress(nativeId);

        const now = Date.now();
        const tracker = speedTracker.current.get(gameId);
        let speed = 0;
        if (tracker) {
          const elapsed = (now - tracker.lastTime) / 1000;
          if (elapsed > 0.5) {
            speed = (prog.bytesDownloaded - tracker.lastBytes) / elapsed;
            speedTracker.current.set(gameId, { lastBytes: prog.bytesDownloaded, lastTime: now });
          }
        }

        if (prog.status === 'success') {
          handleDownloadComplete(gameId);
        } else if (prog.status === 'failed') {
          stopPolling(gameId);
          updateDownload(gameId, {
            status: 'error',
            error: `Tải thất bại (mã lỗi: ${prog.reason})`,
          });
        } else {
          updateDownload(gameId, {
            progress: prog.progress * 0.9,
            speed,
          });
        }
      } catch {}
    }, POLL_INTERVAL);

    pollTimers.current.set(gameId, timer);
  }, [stopPolling, handleDownloadComplete, updateDownload]);

  // === Public: start download ===
  const startDownload = useCallback(async (
    game: ApiGame,
    romDir: string,
    romExtensions: string[]
  ) => {
    const gameId = game.id;
    const existing = downloads.get(gameId);
    if (existing && (existing.status === 'downloading' || existing.status === 'extracting')) return;

    // Store game metadata for later
    gameMeta.current.set(gameId, game);

    // Download to public Downloads/Alga/ folder
    const destSubPath = `Alga/game_${gameId}.zip`;

    setDownloads((prev) => {
      const next = new Map(prev);
      next.set(gameId, {
        gameId,
        gameName: game.name,
        progress: 0,
        status: 'downloading',
        speed: 0,
        retryCount: 0,
      });
      return next;
    });

    try {
      const result = await enqueueDownload(
        game.downloadUrl,
        destSubPath,
        `🎮 ${game.name}`,
        'Alga — Đang tải game...'
      );

      const zipPath = result.filePath;
      downloadMeta.current.set(gameId, { url: game.downloadUrl, romDir, romExtensions, zipPath });

      await AsyncStorage.setItem(`dl_native_${gameId}`, JSON.stringify({
        nativeId: result.downloadId,
        gameId,
        gameName: game.name,
        game,
        downloadUrl: game.downloadUrl,
        romDir,
        romExtensions,
        zipPath,
      }));

      updateDownload(gameId, { nativeDownloadId: result.downloadId });
      startPolling(gameId, result.downloadId);
    } catch (error: any) {
      updateDownload(gameId, {
        status: 'error',
        error: error.message || 'Không thể bắt đầu tải',
      });
    }
  }, [downloads, updateDownload, startPolling]);

  // === Public: cancel download ===
  const cancelDownload = useCallback(async (gameId: number) => {
    const state = downloads.get(gameId);
    if (state?.nativeDownloadId) {
      try { await cancelNativeDownload(state.nativeDownloadId); } catch {}
    }

    stopPolling(gameId);
    downloadMeta.current.delete(gameId);
    gameMeta.current.delete(gameId);
    await AsyncStorage.removeItem(`dl_native_${gameId}`);

    setDownloads((prev) => {
      const next = new Map(prev);
      next.delete(gameId);
      return next;
    });
  }, [downloads, stopPolling]);

  // === Public: retry download ===
  const retryDownload = useCallback(async (gameId: number) => {
    const game = gameMeta.current.get(gameId);
    const meta = downloadMeta.current.get(gameId);
    if (game && meta) {
      // Cancel old first
      await cancelDownload(gameId);
      startDownload(game, meta.romDir, meta.romExtensions);
    }
  }, [cancelDownload, startDownload]);

  // === Public: scan already downloaded games (for current page) ===
  const scanDownloaded = useCallback(async (
    games: { id: number; filename: string }[],
    emulatorId: string,
    romExtensions: string[]
  ) => {
    const found = new Set<number>();
    for (const game of games) {
      const gameFolder = game.filename.replace(/\.zip$/i, '');
      const romDir = `${EXTERNAL_ROM_DIR}/${emulatorId}/${gameFolder}`;
      const rom = await findRomFile(romDir, romExtensions);
      if (rom) {
        found.add(game.id);
        romPaths.current.set(game.id, rom);
      }
    }
    setDownloadedGameIds((prev) => {
      const merged = new Set(prev);
      found.forEach((id) => merged.add(id));
      return merged;
    });

    // Also persist any newly found games
    const fullGames = games as ApiGame[];
    setDownloadedGames((prev) => {
      let updated = [...prev];
      for (const g of fullGames) {
        if (found.has(g.id) && !prev.find((p) => p.id === g.id)) {
          updated.push(g);
        }
      }
      if (updated.length !== prev.length) {
        persistDownloadedGames(updated);
      }
      return updated;
    });
  }, [findRomFile, persistDownloadedGames]);

  // === Resume downloads on app start ===
  useEffect(() => {
    const resumeDownloads = async () => {
      try {
        const keys = await AsyncStorage.getAllKeys();
        const dlKeys = keys.filter((k) => k.startsWith('dl_native_'));

        for (const key of dlKeys) {
          const raw = await AsyncStorage.getItem(key);
          if (!raw) continue;
          const saved = JSON.parse(raw);

          if (saved.game) gameMeta.current.set(saved.gameId, saved.game);
          downloadMeta.current.set(saved.gameId, {
            url: saved.downloadUrl,
            romDir: saved.romDir,
            romExtensions: saved.romExtensions,
            zipPath: saved.zipPath,
          });

          setDownloads((prev) => {
            const next = new Map(prev);
            next.set(saved.gameId, {
              gameId: saved.gameId,
              gameName: saved.gameName,
              progress: 0,
              status: 'downloading',
              speed: 0,
              retryCount: 0,
              nativeDownloadId: saved.nativeId,
            });
            return next;
          });

          startPolling(saved.gameId, saved.nativeId);
        }
      } catch {}
    };

    resumeDownloads();
  }, [startPolling]);

  const getRomPath = useCallback((gameId: number): string | null => {
    return romPaths.current.get(gameId) ?? null;
  }, []);

  const isDownloadedFn = useCallback((gameId: number): boolean => {
    return downloadedGameIds.has(gameId);
  }, [downloadedGameIds]);

  // === Delete game ===
  const deleteGame = useCallback(async (gameId: number, emulatorId: string) => {
    const game = downloadedGames.find((g) => g.id === gameId);
    if (game) {
      const gameFolder = game.filename.replace(/\.zip$/i, '');
      const romDir = `${EXTERNAL_ROM_DIR}/${emulatorId}/${gameFolder}`;
      await deleteFileOrDir(romDir);
    }
    // Remove cover
    const coverPath = `${COVER_DIR}/${gameId}.png`;
    await deleteFileOrDir(coverPath);

    romPaths.current.delete(gameId);
    setDownloadedGames((prev) => {
      const next = prev.filter((g) => g.id !== gameId);
      persistDownloadedGames(next);
      return next;
    });
    setDownloadedGameIds((prev) => {
      const next = new Set(prev);
      next.delete(gameId);
      return next;
    });
  }, [downloadedGames, persistDownloadedGames]);

  // === Download cover art (async, non-blocking) ===
  const downloadCoverArt = useCallback(async (game: ApiGame) => {
    try {
      const destPath = `${COVER_DIR}/${game.id}.png`;

      // Skip if already cached
      const exists = await fileExists(destPath);
      if (exists) return;

      await createDirectory(COVER_DIR);
      const baseName = game.filename.replace(/\.zip$/i, '');
      const thumbBase = THUMB_BASES[game.platform] || THUMB_BASES['nds'];

      // Try each region variant
      const candidates = REGIONS.map((r) => `${thumbBase}/${encodeURIComponent(`${baseName} ${r}`)}.png`);
      candidates.push(`${thumbBase}/${encodeURIComponent(baseName)}.png`);

      for (const url of candidates) {
        try {
          const result = await FileSystem.downloadAsync(url, `${FileSystem.cacheDirectory}cover_${game.id}.png`);
          if (result.status === 200) {
            // Move from cache to permanent location
            const { copyFile: cp } = require('../../modules/app-launcher');
            const cachePath = result.uri.replace('file://', '');
            await cp(cachePath, destPath);
            await FileSystem.deleteAsync(result.uri, { idempotent: true });
            return;
          }
        } catch {}
      }
    } catch {}
  }, []);

  // === Scan local filesystem for library (no API needed) ===
  const scanLocalLibrary = useCallback(async (emulatorId: string, romExtensions: string[]) => {
    // Map emulatorId to platform
    const platformMap: Record<string, string> = { melonds: 'nds', desmume: 'nds', citra: '3ds', mgba: 'gba' };
    const platform = platformMap[emulatorId] ?? '';

    try {
      const baseDir = `${EXTERNAL_ROM_DIR}/${emulatorId}`;
      let romFiles: string[] = [];
      try {
        const files = await listFiles(baseDir);
        romFiles = files.filter((f: string) => {
          const lower = f.toLowerCase();
          return romExtensions.some((ext) => lower.endsWith(ext));
        });
      } catch {} // Directory might not exist yet

      // Only verify games for THIS platform, keep other platforms untouched
      setDownloadedGames((prev) => {
        const otherPlatformGames = prev.filter((g) => g.platform !== platform);
        const thisPlatformGames = prev.filter((g) => g.platform === platform);

        const verified = thisPlatformGames.filter((g) => {
          const gameFolder = g.filename.replace(/\.zip$/i, '');
          const expectedDir = `${baseDir}/${gameFolder}`;
          return romFiles.some((f: string) => f.startsWith(expectedDir));
        });

        const updated = [...otherPlatformGames, ...verified];
        if (updated.length !== prev.length) {
          persistDownloadedGames(updated);
          const ids = new Set(updated.map((g) => g.id));
          setDownloadedGameIds(ids);
        }
        // Download missing covers + extract NDS icons for verified games
        for (const g of verified) {
          downloadCoverArt(g);
          // Extract icon from NDS ROM if no cover exists yet
          if (platform === 'nds') {
            const coverPath = `${COVER_DIR}/${g.id}.png`;
            fileExists(coverPath).then(async (exists) => {
              if (!exists) {
                const gameFolder = g.filename.replace(/\.zip$/i, '');
                const romDir = `${baseDir}/${gameFolder}`;
                try {
                  const romDirFiles = await listFiles(romDir);
                  const ndsFile = romDirFiles.find((f: string) => f.toLowerCase().endsWith('.nds'));
                  if (ndsFile) {
                    await createDirectory(COVER_DIR);
                    await extractNdsIcon(ndsFile, coverPath);
                  }
                } catch {}
              }
            });
          }
        }
        return updated;
      });
    } catch {}
  }, [persistDownloadedGames, downloadCoverArt]);

  const getLocalCoverPath = useCallback((gameId: number): string => {
    return `${COVER_DIR}/${gameId}.png`;
  }, []);

  const value: DownloadManagerContextType = {
    downloads,
    downloadedGameIds,
    downloadedGames,
    startDownload,
    cancelDownload,
    retryDownload,
    deleteGame,
    scanDownloaded,
    scanLocalLibrary,
    getRomPath,
    getLocalCoverPath,
    isDownloaded: isDownloadedFn,
  };

  return (
    <DownloadManagerContext.Provider value={value}>
      {children}
    </DownloadManagerContext.Provider>
  );
};

export const useDownloadManager = () => {
  const ctx = useContext(DownloadManagerContext);
  if (!ctx) throw new Error('useDownloadManager must be used within DownloadManagerProvider');
  return ctx;
};

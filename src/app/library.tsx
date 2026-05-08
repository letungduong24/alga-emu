import { CustomAlert } from '@/components/CustomAlert';
import { EMULATORS } from '@/constants/emulators';
import { useDownloadManager } from '@/hooks/useDownloadManager';
import { useCore } from '@/hooks/useEmulator';
import { ApiGame } from '@/hooks/useGameApi';
import { useGameImport } from '@/hooks/useGameImport';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Download, Grid3x3, List, MoreVertical, Play, Plus, Search, Trash2, Upload, Wrench, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList, Image,
  ImageBackground,
  Modal,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { exportSave, fileExists, hasSave, importSave, launchGame } from '../../modules/app-launcher';

const CARD_WIDTH = 200;
const CARD_MARGIN = 12;
const SNAP_INTERVAL = CARD_WIDTH + CARD_MARGIN * 2;
const PRIMARY = '#00f2ff';

const OPERATION_MESSAGES: Record<string, string> = {
  idle: '',
  validating: 'Đang kiểm tra file...',
  copying: 'Đang sao chép ROM...',
  extracting: 'Đang giải nén...',
  processing: 'Đang xử lý metadata...',
  done: 'Hoàn tất!',
};

type ViewMode = 'carousel' | 'grid';

export default function LibraryScreen() {
  const { emulatorId } = useLocalSearchParams<{ emulatorId: string }>();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isLandscape = width > height;

  const CARD_W = isLandscape ? 140 : CARD_WIDTH;
  const SNAP = CARD_W + CARD_MARGIN * 2;

  const emulator = EMULATORS.find((e) => e.id === emulatorId);
  const downloadManager = useDownloadManager();
  const {
    downloadedGames, scanLocalLibrary,
    getRomPath, deleteGame,
    downloads,
  } = downloadManager;
  const { isCoreReady, isDownloading: coreLoading, progress: coreProgress, downloadCore, corePath } = useCore(
    emulator?.coreName ?? '', emulator?.coreUrl ?? ''
  );
  
  const { importState, startImport } = useGameImport();

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ApiGame | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('carousel');
  const [actionTarget, setActionTarget] = useState<ApiGame | null>(null);
  const [exportAlert, setExportAlert] = useState<{ title: string; message: string } | null>(null);
  const [importAlert, setImportAlert] = useState<{ title: string; message: string } | null>(null);
  const [showFixMenu, setShowFixMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const emulatorGames = useMemo(() => {
    return downloadedGames.filter((g) => {
      const platformMap: Record<string, string> = { melonds: 'nds', desmume: 'nds', citra: '3ds', mgba: 'gba', ppsspp: 'psp' };
      const platform = platformMap[emulatorId ?? ''] ?? '';
      return g.platform === platform;
    });
  }, [downloadedGames, emulatorId]);

  const filteredGames = useMemo(() => {
    let games = emulatorGames;
    
    // Filter by search text
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      games = games.filter((g) => g.name.toLowerCase().includes(q));
    }
    
    // Sort: downloading games first, keep original order for the rest
    return games.sort((a, b) => {
      const aDownloading = downloads.has(a.id);
      const bDownloading = downloads.has(b.id);
      
      // Downloading games first
      if (aDownloading && !bDownloading) return -1;
      if (!aDownloading && bDownloading) return 1;
      
      // Keep original order
      return 0;
    });
  }, [emulatorGames, searchText, downloads]);

  useEffect(() => {
    if (emulator) {
      scanLocalLibrary(emulator.id, emulator.romExtension);
    }
  }, [emulator]);

  const selectedGame = filteredGames[selectedIndex] ?? null;
  const carouselPadding = (width - CARD_W) / 2;

  // Get romBaseName from actual ROM file (core saves use ROM filename, not zip name)
  const getRomBaseName = useCallback((game: ApiGame) => {
    const romPath = getRomPath(game.id);
    if (romPath) {
      // Extract filename without extension from full path
      const fileName = romPath.split('/').pop() || '';
      const dotIdx = fileName.lastIndexOf('.');
      return dotIdx > 0 ? fileName.substring(0, dotIdx) : fileName;
    }
    // Fallback to zip name
    return game.filename.replace(/\.zip$/i, '');
  }, [getRomPath]);

  // Play game
  const handlePlay = useCallback(async (game?: ApiGame) => {
    const target = game || selectedGame;
    if (!target || !emulator) return;
    if (!isCoreReady) { downloadCore(); return; }

    let rom = getRomPath(target.id);
    if (!rom) {
      const gameFolder = target.filename.replace(/\.zip$/i, '');
      const romDir = `/storage/emulated/0/Alga/roms/${emulator.id}/${gameFolder}`;
      const { listFiles: lf } = require('../../modules/app-launcher');
      const files = await lf(romDir);
      rom = files?.find((f: string) => emulator.romExtension.some((ext) => f.toLowerCase().endsWith(ext)));
    }

    if (rom) {
      try {
        const FileSystem = require('expo-file-system/legacy');
        const { copyFile } = require('../../modules/app-launcher');
        const docDir = (FileSystem.documentDirectory || '').replace('file://', '');
        const internalCoreDir = `${docDir}cores/`;
        const internalCorePath = `${internalCoreDir}${emulator.coreName}`;
        const dirInfo = await FileSystem.getInfoAsync(`${FileSystem.documentDirectory}cores/`);
        if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}cores/`, { intermediates: true });
        const coreInfo = await FileSystem.getInfoAsync(`${FileSystem.documentDirectory}cores/${emulator.coreName}`);
        if (!coreInfo.exists) await copyFile(corePath, internalCorePath);
        await launchGame(internalCorePath, rom);
      } catch (error: any) {
        console.error('[Alga] Launch error:', error);
      }
    }
  }, [selectedGame, emulator, isCoreReady, corePath, getRomPath, downloadCore]);

  // Delete game
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget || !emulator) return;
    
    // Find index of game being deleted
    const deleteIndex = filteredGames.findIndex(g => g.id === deleteTarget.id);
    
    // Delete the game
    await deleteGame(deleteTarget.id, emulator.id);
    setDeleteTarget(null);
    
    // Calculate new selected index BEFORE state updates
    const newLength = filteredGames.length - 1; // After deletion
    let newSelectedIndex = selectedIndex;
    
    if (deleteIndex === selectedIndex) {
      // Deleted the currently selected game
      if (selectedIndex > 0) {
        // Move to previous game
        newSelectedIndex = selectedIndex - 1;
      } else {
        // Was at first game, stay at 0 if there are more games
        newSelectedIndex = 0;
      }
    } else if (deleteIndex < selectedIndex) {
      // Deleted a game before the selected one, shift index down
      newSelectedIndex = selectedIndex - 1;
    }
    
    // Ensure index is within bounds
    if (newSelectedIndex >= newLength) {
      newSelectedIndex = Math.max(0, newLength - 1);
    }
    
    // Update selected index
    setSelectedIndex(newSelectedIndex);
    
    // Scroll to new position after state update
    setTimeout(() => {
      if (newLength > 0 && flatListRef.current) {
        flatListRef.current.scrollToIndex({ 
          index: newSelectedIndex, 
          animated: true, 
          viewPosition: 0.5 
        });
      }
    }, 100);
  }, [deleteTarget, emulator, deleteGame, selectedIndex, filteredGames]);

  // Export save
  const handleExportSave = useCallback(async (game: ApiGame) => {
    try {
      const romBase = getRomBaseName(game);
      const coreId = emulatorId ?? '';
      const exists = await hasSave(romBase, coreId);
      if (!exists) {
        setExportAlert({ title: 'Không có save', message: `Game "${game.name}" chưa có file save nào.` });
        setActionTarget(null);
        return;
      }
      const path = await exportSave(romBase, coreId);
      const fileName = path.split('/').pop() || romBase;
      setExportAlert({ title: 'Export thành công', message: `Đã lưu tại:\n/Alga/saves/${fileName}` });
    } catch (e: any) {
      setExportAlert({ title: 'Lỗi', message: e.message });
    }
    setActionTarget(null);
  }, [getRomBaseName, emulatorId]);

  // Import save — file picker + custom alert confirm/success
  const [importPending, setImportPending] = useState<{ romBase: string; fileUri: string; fileName: string; gameName: string } | null>(null);

  const handleImportSave = useCallback(async (game: ApiGame) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) {
        setActionTarget(null);
        return;
      }
      const file = result.assets[0];
      const romBase = getRomBaseName(game);
      setImportPending({ romBase, fileUri: file.uri, fileName: file.name, gameName: game.name });
    } catch (e: any) {
      setExportAlert({ title: 'Lỗi import', message: e.message });
    }
    setActionTarget(null);
  }, [getRomBaseName]);

  const handleImportConfirm = useCallback(async () => {
    if (!importPending) return;
    try {
      const coreId = emulatorId ?? '';
      await importSave(importPending.romBase, importPending.fileUri, coreId);
      setExportAlert({ title: 'Import thành công', message: `Đã import save cho "${importPending.gameName}"` });
    } catch (e: any) {
      setExportAlert({ title: 'Lỗi', message: e.message });
    }
    setImportPending(null);
  }, [importPending, emulatorId]);

  // Fix Tomodachi Life - Download MiiFix using download manager
  const handleFixTomodachiLife = useCallback(async () => {
    setShowFixMenu(false);
    
    try {
      const { createDirectory, fileExists } = require('../../modules/app-launcher');
      
      console.log('[Fix Tomodachi] Starting...');
      
      // Check if MiiFix already exists in library
      const miiFixExists = downloadedGames.some((g) => g.id === -999999);
      
      // Check if MiiFix.3ds file exists
      const citraRomDir = '/storage/emulated/0/Alga/roms/citra/MiiFix/';
      const destRomPath = `${citraRomDir}MiiFix.3ds`;
      const fileAlreadyExists = await fileExists(destRomPath);
      
      if (miiFixExists && fileAlreadyExists) {
        // MiiFix already installed
        setExportAlert({ 
          title: 'MiiFix đã có sẵn', 
          message: `MiiFix đã có trong thư viện.\n\nHƯỚNG DẪN:\n1. Mở game "MiiFix" trong thư viện\n2. Chạy MiiFix để fix lỗi Mii\n3. Sau đó mở Tomodachi Life để tạo Mii` 
        });
        return;
      }
      
      // Create MiiFix game object
      const miiFixGame: ApiGame = {
        id: -999999, // Special ID for MiiFix
        name: 'MiiFix',
        filename: 'MiiFix.zip',
        platform: '3ds',
        downloadUrl: 'https://duongle.dev/MiiFix.3ds',
        size: 0,
      };
      
      // Ensure directory exists
      await createDirectory(citraRomDir);
      
      // Start download using download manager
      console.log('[Fix Tomodachi] Starting download via download manager...');
      downloadManager.startDownload(
        miiFixGame,
        citraRomDir,
        ['.3ds', '.cci', '.cxi', '.3dsx']
      );
      
      // Refresh library to show MiiFix
      if (emulator) {
        scanLocalLibrary(emulator.id, emulator.romExtension);
      }
      
      // Show info
      setExportAlert({ 
        title: 'Đang tải MiiFix', 
        message: `MiiFix đang được tải xuống.\n\nSau khi tải xong:\n1. Mở game "MiiFix" trong thư viện\n2. Chạy MiiFix để fix lỗi Mii\n3. Sau đó mở Tomodachi Life để tạo Mii` 
      });
      
    } catch (e: any) {
      console.error('[Fix Tomodachi] Error:', e);
      setExportAlert({ title: 'Lỗi tải MiiFix', message: e.message });
    }
  }, [emulator, scanLocalLibrary, downloadManager, downloadedGames]);



  // Handle game import
  const handleGameImport = useCallback(async () => {
    if (!emulator) return;
    
    const result = await startImport(emulator.id);
    
    if (result.success && result.game) {
      // Show success message
      setImportAlert({ 
        title: 'Import thành công', 
        message: `Đã import game "${result.game.name}" vào thư viện!` 
      });
      
      // Refresh library
      scanLocalLibrary(emulator.id, emulator.romExtension);
    } else if (result.error) {
      // Show error message
      setImportAlert({ 
        title: 'Lỗi import', 
        message: result.error 
      });
    }
  }, [emulator, startImport, scanLocalLibrary]);

  const onScrollEnd = (e: any) => {
    const x = e.nativeEvent.contentOffset.x;
    const index = Math.round(x / SNAP);
    if (index >= 0 && index < filteredGames.length) setSelectedIndex(index);
  };

  if (!emulator) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <Text className="text-white">Không tìm thấy hệ máy</Text>
      </View>
    );
  }

  // === EMPTY STATE ===
  if (filteredGames.length === 0 && !searchText) {
    return (
      <View className="flex-1 bg-black">
        <StatusBar hidden />
        <ImageBackground source={emulator.image} className="w-full h-full" blurRadius={30}>
          <View className="absolute inset-0 bg-black/60" />
          <View style={{ paddingTop: insets.top }} className="flex-row items-center px-5 py-3">
            <TouchableOpacity onPress={() => router.back()} className="mr-3 p-2">
              <ArrowLeft size={22} color="white" />
            </TouchableOpacity>
            <Text className="text-white text-xl font-bold">{emulator.title}</Text>
          </View>
          <Animated.View entering={FadeInDown.duration(600)} className="flex-1 items-center justify-center px-8">
            <Text style={{ fontSize: 64 }} className="mb-4">🎮</Text>
            <Text className="text-white text-2xl font-bold text-center mb-2">Thư viện trống</Text>
            <Text className="text-white/50 text-center mb-8">Tải game đầu tiên để bắt đầu chơi!</Text>
            <View className="flex-row gap-x-3">
              <TouchableOpacity
                onPress={handleGameImport}
                className="px-10 py-4 rounded-full flex-row items-center bg-white/10 border border-white/20"
              >
                <Upload size={20} color="white" />
                <Text className="text-white font-extrabold text-lg ml-2">Import</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/games', params: { emulatorId: emulator.id } })}
                className="px-10 py-4 rounded-full flex-row items-center"
                style={{ backgroundColor: PRIMARY }}
              >
                <Plus size={20} color="black" />
                <Text className="text-black font-extrabold text-lg ml-2">Tải game</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ImageBackground>
      </View>
    );
  }

  // === HEADER ===
  const renderHeader = () => (
    <>
      <View style={{ paddingTop: insets.top }} className="flex-row items-center justify-between px-5 py-3 z-10">
        <View className="flex-row items-center flex-shrink">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 p-2">
            <ArrowLeft size={22} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold" numberOfLines={1}>{emulator.title}</Text>
        </View>
        <View className="flex-row items-center gap-x-2 flex-shrink-0">
          <TouchableOpacity onPress={() => setShowSearch(!showSearch)} className="p-2">
            {showSearch ? <X size={20} color="white" /> : <Search size={20} color="white" />}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setViewMode(viewMode === 'carousel' ? 'grid' : 'carousel')}
            className="p-2"
          >
            {viewMode === 'carousel' ? <Grid3x3 size={20} color="white" /> : <List size={20} color="white" />}
          </TouchableOpacity>
          {emulatorId === 'citra' && (
            <TouchableOpacity
              onPress={() => setShowMoreMenu(true)}
              className="p-2"
            >
              <MoreVertical size={20} color="white" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/games', params: { emulatorId: emulator.id } })}
            className="px-3 py-2 rounded-full flex-row items-center"
            style={{ backgroundColor: PRIMARY }}
          >
            <Plus size={16} color="black" />
          </TouchableOpacity>
        </View>
      </View>

      {showSearch && (
        <Animated.View entering={FadeInDown.duration(300)} className="px-5 pb-3 z-10">
          <TextInput
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Tìm kiếm game..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            className="bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white"
            autoFocus
          />
        </Animated.View>
      )}
    </>
  );

  // === ACTION MENU ===
  const renderActionMenu = () => (
    <Modal visible={!!actionTarget} transparent animationType="fade" onRequestClose={() => setActionTarget(null)}>
      <TouchableOpacity
        className="flex-1 justify-end"
        activeOpacity={1}
        onPress={() => setActionTarget(null)}
        style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      >
        <View className="bg-[#1a1a2e] rounded-t-3xl px-6 pt-6 pb-8" style={{ paddingBottom: insets.bottom + 24 }}>
          <Text className="text-white text-lg font-bold mb-1" numberOfLines={1}>{actionTarget?.name}</Text>
          <Text className="text-white/40 text-xs mb-5">Quản lý game</Text>

          <TouchableOpacity
            onPress={() => { setActionTarget(null); handlePlay(actionTarget!); }}
            className="flex-row items-center py-4 border-b border-white/5"
          >
            <View className="w-10 h-10 rounded-xl items-center justify-center mr-4" style={{ backgroundColor: PRIMARY + '20' }}>
              <Play size={18} color={PRIMARY} fill={PRIMARY} />
            </View>
            <Text className="text-white font-semibold text-base">Chơi game</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleExportSave(actionTarget!)}
            className="flex-row items-center py-4 border-b border-white/5"
          >
            <View className="w-10 h-10 rounded-xl items-center justify-center mr-4 bg-emerald-500/20">
              <Upload size={18} color="#10b981" />
            </View>
            <View>
              <Text className="text-white font-semibold text-base">Export Save</Text>
              <Text className="text-white/40 text-xs">Xuất file .sav (PKHeX, backup)</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleImportSave(actionTarget!)}
            className="flex-row items-center py-4 border-b border-white/5"
          >
            <View className="w-10 h-10 rounded-xl items-center justify-center mr-4 bg-blue-500/20">
              <Download size={18} color="#3b82f6" />
            </View>
            <View>
              <Text className="text-white font-semibold text-base">Import Save</Text>
              <Text className="text-white/40 text-xs">Nhập file .sav đã chỉnh sửa</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => { setActionTarget(null); setDeleteTarget(actionTarget); }}
            className="flex-row items-center py-4"
          >
            <View className="w-10 h-10 rounded-xl items-center justify-center mr-4 bg-red-500/20">
              <Trash2 size={18} color="#ef4444" />
            </View>
            <Text className="text-red-400 font-semibold text-base">Xóa game</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // === GRID VIEW ===
  if (viewMode === 'grid') {
    const GRID_COLS = 3;
    const GRID_GAP = 10;
    const GRID_ITEM_WIDTH = (width - 40 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

    return (
      <View className="flex-1 bg-black">
        <StatusBar hidden />
        <View className="absolute inset-0">
          <ImageBackground source={emulator.image} className="w-full h-full" blurRadius={30}>
            <View className="absolute inset-0 bg-black/50" />
          </ImageBackground>
        </View>
        {renderHeader()}
        <FlatList
          data={filteredGames}
          keyExtractor={(item) => item.id.toString()}
          numColumns={GRID_COLS}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 20 }}
          columnWrapperStyle={{ gap: GRID_GAP, marginBottom: GRID_GAP }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <GridGameItem
              game={item}
              width={GRID_ITEM_WIDTH}
              onPlay={() => setActionTarget(item)}
              onLongPress={() => setActionTarget(item)}
            />
          )}
        />
        {renderActionMenu()}
        <CustomAlert
          visible={!!deleteTarget}
          title="Xoá game?"
          message={`Bạn có chắc muốn xoá "${deleteTarget?.name}"? File ROM sẽ bị xoá vĩnh viễn.`}
          confirmText="Xoá"
          cancelText="Giữ lại"
          confirmColor="#ef4444"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
        <CustomAlert
          visible={!!exportAlert}
          title={exportAlert?.title ?? ''}
          message={exportAlert?.message ?? ''}
          confirmText="OK"
          confirmColor={PRIMARY}
          onConfirm={() => setExportAlert(null)}
        />
        <CustomAlert
          visible={!!importPending}
          title="Import Save"
          message={`Import "${importPending?.fileName}" cho "${importPending?.gameName}"?\n\nSave hiện tại sẽ bị ghi đè.`}
          confirmText="Import"
          cancelText="Huỷ"
          confirmColor={PRIMARY}
          onConfirm={handleImportConfirm}
          onCancel={() => setImportPending(null)}
        />
      </View>
    );
  }

  // === CAROUSEL VIEW ===
  return (
    <View className="flex-1 bg-black">
      <StatusBar hidden />
      <View className="absolute inset-0">
        <ImageBackground source={emulator.image} className="w-full h-full" blurRadius={30}>
          <View className="absolute inset-0 bg-black/50" />
        </ImageBackground>
      </View>
      {renderHeader()}

      <View className="flex-1 justify-center">
        <FlatList
          ref={flatListRef}
          data={filteredGames}
          keyExtractor={(item) => item.id.toString()}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: carouselPadding, alignItems: 'center' }}
          snapToInterval={SNAP}
          decelerationRate="fast"
          onMomentumScrollEnd={onScrollEnd}
          onScroll={(e) => {
            const x = e.nativeEvent.contentOffset.x;
            const idx = Math.round(x / SNAP);
            if (idx >= 0 && idx < filteredGames.length && idx !== selectedIndex) setSelectedIndex(idx);
          }}
          scrollEventThrottle={16}
          renderItem={({ item, index }) => (
            <CarouselItem
              game={item}
              isSelected={index === selectedIndex}
              onPress={() => {
                if (index !== selectedIndex) {
                  setSelectedIndex(index);
                  flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
                }
              }}
              onLongPress={() => setActionTarget(item)}
              cardWidth={CARD_W}
              isLandscape={isLandscape}
            />
          )}
        />
      </View>

      {/* Selected Game Info + Actions */}
      {selectedGame && (
        <View style={{ paddingBottom: insets.bottom + 16 }} className="px-8">
          <Text className="text-white text-2xl font-bold tracking-tight mb-4" numberOfLines={2}>
            {selectedGame.name}
          </Text>
          <View className="flex-row items-center gap-x-3">
            {/* PLAY */}
            <TouchableOpacity
              onPress={() => handlePlay()}
              disabled={coreLoading}
              className="flex-1 py-4 rounded-2xl flex-row items-center justify-center"
              style={{ backgroundColor: PRIMARY, shadowColor: PRIMARY, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 }}
            >
              {coreLoading ? (
                <Text className="text-black font-bold text-base">
                  Tải Core {Math.round(coreProgress * 100)}%
                </Text>
              ) : (
                <>
                  <Play size={20} color="black" fill="black" />
                  <Text className="text-black font-bold text-base ml-2">Chơi</Text>
                </>
              )}
            </TouchableOpacity>

            {/* MORE ACTIONS */}
            <TouchableOpacity
              onPress={() => setActionTarget(selectedGame)}
              className="bg-white/10 p-4 rounded-2xl border border-white/10"
            >
              <MoreVertical size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {renderActionMenu()}
      <CustomAlert
        visible={!!deleteTarget}
        title="Xoá game?"
        message={`Bạn có chắc muốn xoá "${deleteTarget?.name}"? File ROM sẽ bị xoá vĩnh viễn.`}
        confirmText="Xoá"
        cancelText="Giữ lại"
        confirmColor="#ef4444"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
      <CustomAlert
        visible={!!exportAlert}
        title={exportAlert?.title ?? ''}
        message={exportAlert?.message ?? ''}
        confirmText="OK"
        confirmColor={PRIMARY}
        onConfirm={() => setExportAlert(null)}
      />
      <CustomAlert
        visible={!!importPending}
        title="Import Save"
        message={`Import "${importPending?.fileName}" cho "${importPending?.gameName}"?\n\nSave hiện tại sẽ bị ghi đè.`}
        confirmText="Import"
        cancelText="Huỷ"
        confirmColor={PRIMARY}
        onConfirm={handleImportConfirm}
        onCancel={() => setImportPending(null)}
      />
      
      {/* Import Success/Error Alert */}
      <CustomAlert
        visible={!!importAlert}
        title={importAlert?.title ?? ''}
        message={importAlert?.message ?? ''}
        confirmText="OK"
        confirmColor={PRIMARY}
        onConfirm={() => setImportAlert(null)}
      />
      
      {/* Import Progress Overlay */}
      {importState.isImporting && (
        <View className="absolute inset-0 bg-black/80 items-center justify-center z-50">
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text className="text-white mt-4 text-lg">
            {OPERATION_MESSAGES[importState.currentOperation] || 'Đang import...'}
          </Text>
        </View>
      )}
      
      {/* Fix Menu Modal */}
      <Modal visible={showFixMenu} transparent animationType="fade" onRequestClose={() => setShowFixMenu(false)}>
        <TouchableOpacity
          className="flex-1 justify-end"
          activeOpacity={1}
          onPress={() => setShowFixMenu(false)}
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
        >
          <View className="bg-[#1a1a2e] rounded-t-3xl px-6 pt-6 pb-8" style={{ paddingBottom: insets.bottom + 24 }}>
            <Text className="text-white text-lg font-bold mb-1">Fix lỗi game</Text>
            <Text className="text-white/40 text-xs mb-5">Chọn lỗi cần fix</Text>

            <TouchableOpacity
              onPress={handleFixTomodachiLife}
              className="flex-row items-center py-4"
            >
              <View className="w-10 h-10 rounded-xl items-center justify-center mr-4 bg-amber-500/20">
                <Wrench size={18} color="#fbbf24" />
              </View>
              <View className="flex-1">
                <Text className="text-white font-semibold text-base">Tomodachi Life - Mii Fix</Text>
                <Text className="text-white/40 text-xs">Fix lỗi không tạo được Mii</Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      
      {/* More Menu Modal (for Citra) */}
      <Modal visible={showMoreMenu} transparent animationType="fade" onRequestClose={() => setShowMoreMenu(false)}>
        <TouchableOpacity
          className="flex-1 justify-end"
          activeOpacity={1}
          onPress={() => setShowMoreMenu(false)}
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
        >
          <View className="bg-[#1a1a2e] rounded-t-3xl px-6 pt-6 pb-8" style={{ paddingBottom: insets.bottom + 24 }}>
            <Text className="text-white text-lg font-bold mb-1">Thêm</Text>
            <Text className="text-white/40 text-xs mb-5">Chọn hành động</Text>

            <TouchableOpacity
              onPress={() => { setShowMoreMenu(false); handleGameImport(); }}
              className="flex-row items-center py-4 border-b border-white/5"
            >
              <View className="w-10 h-10 rounded-xl items-center justify-center mr-4 bg-blue-500/20">
                <Upload size={18} color="#3b82f6" />
              </View>
              <View className="flex-1">
                <Text className="text-white font-semibold text-base">Import Game</Text>
                <Text className="text-white/40 text-xs">Nhập game từ file ZIP</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { setShowMoreMenu(false); setShowFixMenu(true); }}
              className="flex-row items-center py-4"
            >
              <View className="w-10 h-10 rounded-xl items-center justify-center mr-4 bg-amber-500/20">
                <Wrench size={18} color="#fbbf24" />
              </View>
              <View className="flex-1">
                <Text className="text-white font-semibold text-base">Fix</Text>
                <Text className="text-white/40 text-xs">Fix lỗi game Citra</Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const COVER_DIR = '/storage/emulated/0/Alga/covers';

const CoverImage = React.memo(({ game, style }: { game: ApiGame; style?: any }) => {
  const [hasLocal, setHasLocal] = useState<boolean | null>(null);
  const localPath = `${COVER_DIR}/${game.id}.png`;

  useEffect(() => {
    fileExists(localPath).then((exists) => setHasLocal(exists));
  }, [localPath]);

  if (hasLocal === null) return null;

  if (hasLocal) {
    return (
      <Image
        source={{ uri: `file://${localPath}` }}
        className="w-full h-full"
        resizeMode="cover"
        style={style}
        onError={() => setHasLocal(false)}
      />
    );
  }

  return (
    <View className="w-full h-full items-center justify-center bg-white/5" style={style}>
      <Text className="text-white/60 text-5xl font-black">
        {game.name.charAt(0).toUpperCase()}
      </Text>
      <Text className="text-white/30 text-xs mt-1 px-3 text-center" numberOfLines={2}>
        {game.name}
      </Text>
    </View>
  );
});

// === Carousel Item ===
interface CarouselItemProps {
  game: ApiGame;
  isSelected: boolean;
  onPress: () => void;
  onLongPress: () => void;
  cardWidth?: number;
  isLandscape?: boolean;
}

const CarouselItem: React.FC<CarouselItemProps> = ({ game, isSelected, onPress, onLongPress, cardWidth = CARD_WIDTH, isLandscape = false }) => {
  const selectedScale = isLandscape ? 1.02 : 1.05;
  const unselectedScale = isLandscape ? 0.9 : 0.85;
  const scale = useSharedValue(unselectedScale);
  const borderOpacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(isSelected ? selectedScale : unselectedScale, { damping: 18, stiffness: 160 });
    borderOpacity.value = withSpring(isSelected ? 1 : 0, { damping: 18, stiffness: 160 });
  }, [isSelected]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: 0.4 + borderOpacity.value * 0.6,
  }));

  const borderStyle = useAnimatedStyle(() => {
    const alpha = Math.round(Math.max(0, Math.min(1, borderOpacity.value)) * 1000) / 1000;
    return { borderColor: `rgba(0,242,255,${alpha})` };
  });

  return (
    <TouchableOpacity onPress={onPress} onLongPress={onLongPress} activeOpacity={0.9}>
      <Animated.View style={[{ width: cardWidth, marginHorizontal: CARD_MARGIN }, animatedStyle]}>
        <Animated.View
          style={[{ aspectRatio: 1, borderWidth: 2 }, borderStyle]}
          className="rounded-2xl overflow-hidden bg-white/5"
        >
          <CoverImage game={game} />
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
};

// === Grid Item ===
interface GridItemProps {
  game: ApiGame;
  width: number;
  onPlay: () => void;
  onLongPress: () => void;
}

const GridGameItem: React.FC<GridItemProps> = ({ game, width, onPlay, onLongPress }) => {
  return (
    <TouchableOpacity
      onPress={onPlay}
      onLongPress={onLongPress}
      activeOpacity={0.85}
      style={{ width }}
    >
      <View
        className="rounded-xl overflow-hidden bg-white/5 border border-white/10"
        style={{ aspectRatio: 1 }}
      >
        <CoverImage game={game} />
        <View className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1.5">
          <Text className="text-white text-[10px] font-bold" numberOfLines={1}>
            {game.name}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

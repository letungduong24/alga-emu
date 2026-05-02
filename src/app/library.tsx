import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, Image, StatusBar, ImageBackground,
  useWindowDimensions, TouchableOpacity, TextInput, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { EMULATORS } from '@/constants/emulators';
import { useDownloadManager } from '@/hooks/useDownloadManager';
import { useCore } from '@/hooks/useEmulator';
import { launchGame, fileExists, exportSave, importSave, hasSave, hasExternalSave } from '../../modules/app-launcher';
import { CustomAlert } from '@/components/CustomAlert';
import { ApiGame } from '@/hooks/useGameApi';
import { ArrowLeft, Search, Plus, Play, Trash2, X, Grid3x3, List, Download, Upload, MoreVertical } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import Animated, {
  FadeIn, FadeInDown, FadeInUp,
  useAnimatedStyle, withSpring, useSharedValue,
} from 'react-native-reanimated';

const CARD_WIDTH = 200;
const CARD_MARGIN = 12;
const SNAP_INTERVAL = CARD_WIDTH + CARD_MARGIN * 2;
const PRIMARY = '#00f2ff';

type ViewMode = 'carousel' | 'grid';

export default function LibraryScreen() {
  const { emulatorId } = useLocalSearchParams<{ emulatorId: string }>();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const emulator = EMULATORS.find((e) => e.id === emulatorId);
  const {
    downloadedGames, scanLocalLibrary,
    getRomPath, deleteGame,
  } = useDownloadManager();
  const { isCoreReady, isDownloading: coreLoading, progress: coreProgress, downloadCore, corePath } = useCore(
    emulator?.coreName ?? '', emulator?.coreUrl ?? ''
  );

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ApiGame | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('carousel');
  const [actionTarget, setActionTarget] = useState<ApiGame | null>(null);
  const [exportAlert, setExportAlert] = useState<{ title: string; message: string } | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const emulatorGames = useMemo(() => {
    return downloadedGames.filter((g) => {
      const platformMap: Record<string, string> = { melonds: 'nds', desmume: 'nds', citra: '3ds', mgba: 'gba' };
      const platform = platformMap[emulatorId ?? ''] ?? '';
      return g.platform === platform;
    });
  }, [downloadedGames, emulatorId]);

  const filteredGames = useMemo(() => {
    if (!searchText.trim()) return emulatorGames;
    const q = searchText.toLowerCase();
    return emulatorGames.filter((g) => g.name.toLowerCase().includes(q));
  }, [emulatorGames, searchText]);

  useEffect(() => {
    if (emulator) {
      scanLocalLibrary(emulator.id, emulator.romExtension);
    }
  }, [emulator]);

  const selectedGame = filteredGames[selectedIndex] ?? null;
  const carouselPadding = (width - CARD_WIDTH) / 2;

  // Get romBaseName from game
  const getRomBaseName = useCallback((game: ApiGame) => {
    return game.filename.replace(/\.zip$/i, '');
  }, []);

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
    await deleteGame(deleteTarget.id, emulator.id);
    setDeleteTarget(null);
    if (selectedIndex >= filteredGames.length - 1 && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
  }, [deleteTarget, emulator, deleteGame, selectedIndex, filteredGames]);

  // Export save
  const handleExportSave = useCallback(async (game: ApiGame) => {
    try {
      const romBase = getRomBaseName(game);
      const exists = await hasSave(romBase);
      if (!exists) {
        setExportAlert({ title: 'Không có save', message: `Game "${game.name}" chưa có file save nào.` });
        setActionTarget(null);
        return;
      }
      await exportSave(romBase);
      setExportAlert({ title: 'Export thành công', message: `Đã lưu tại:\n/Alga/saves/${romBase}.sav` });
    } catch (e: any) {
      setExportAlert({ title: 'Lỗi', message: e.message });
    }
    setActionTarget(null);
  }, [getRomBaseName]);

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
      await importSave(importPending.romBase, importPending.fileUri);
      setExportAlert({ title: 'Import thành công', message: `Đã import save cho "${importPending.gameName}"` });
    } catch (e: any) {
      setExportAlert({ title: 'Lỗi', message: e.message });
    }
    setImportPending(null);
  }, [importPending]);

  const onScrollEnd = (e: any) => {
    const x = e.nativeEvent.contentOffset.x;
    const index = Math.round(x / SNAP_INTERVAL);
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
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/games', params: { emulatorId: emulator.id } })}
              className="px-10 py-4 rounded-full flex-row items-center"
              style={{ backgroundColor: PRIMARY }}
            >
              <Plus size={20} color="black" />
              <Text className="text-black font-extrabold text-lg ml-2">Tải game</Text>
            </TouchableOpacity>
          </Animated.View>
        </ImageBackground>
      </View>
    );
  }

  // === HEADER ===
  const renderHeader = () => (
    <>
      <View style={{ paddingTop: insets.top }} className="flex-row items-center justify-between px-5 py-3 z-10">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 p-2">
            <ArrowLeft size={22} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">{emulator.title}</Text>
        </View>
        <View className="flex-row items-center gap-x-2">
          <TouchableOpacity onPress={() => setShowSearch(!showSearch)} className="p-2">
            {showSearch ? <X size={20} color="white" /> : <Search size={20} color="white" />}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setViewMode(viewMode === 'carousel' ? 'grid' : 'carousel')}
            className="p-2"
          >
            {viewMode === 'carousel' ? <Grid3x3 size={20} color="white" /> : <List size={20} color="white" />}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/games', params: { emulatorId: emulator.id } })}
            className="px-4 py-2 rounded-full flex-row items-center"
            style={{ backgroundColor: PRIMARY }}
          >
            <Plus size={16} color="black" />
            <Text className="text-black font-bold text-xs ml-1">Tải thêm</Text>
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
          snapToInterval={SNAP_INTERVAL}
          decelerationRate="fast"
          onMomentumScrollEnd={onScrollEnd}
          onScroll={(e) => {
            const x = e.nativeEvent.contentOffset.x;
            const idx = Math.round(x / SNAP_INTERVAL);
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
}

const CarouselItem: React.FC<CarouselItemProps> = ({ game, isSelected, onPress, onLongPress }) => {
  const scale = useSharedValue(0.85);
  const borderOpacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(isSelected ? 1.05 : 0.85, { damping: 18, stiffness: 160 });
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
      <Animated.View style={[{ width: CARD_WIDTH, marginHorizontal: CARD_MARGIN }, animatedStyle]}>
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

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Pressable } from 'react-native';
import { DownloadCloud, Loader2, CheckCircle2, Gamepad2, X, RotateCcw, Info } from 'lucide-react-native';
import { ApiGame } from '@/hooks/useGameApi';
import { Emulator } from '@/constants/emulators';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useDownloadManager } from '@/hooks/useDownloadManager';
import { useEffect } from 'react';
import { CustomAlert } from '@/components/CustomAlert';

const EXTERNAL_ROM_DIR = '/storage/emulated/0/Alga/roms';

interface Props {
  game: ApiGame;
  emulator: Emulator;
  index: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return '';
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

// === Main Card ===
export const ApiGameCard = ({ game, emulator, index }: Props) => {
  const {
    downloads,
    isDownloaded,
    startDownload,
    cancelDownload,
    retryDownload,
    getRomPath,
  } = useDownloadManager();

  const [showDetail, setShowDetail] = useState(false);

  const downloaded = isDownloaded(game.id);
  const dlState = downloads.get(game.id);
  const isActive = dlState && (dlState.status === 'downloading' || dlState.status === 'extracting');
  const isError = dlState?.status === 'error';

  const gameFolder = game.filename.replace(/\.zip$/i, '');
  const romDir = `${EXTERNAL_ROM_DIR}/${emulator.id}/${gameFolder}`;

  // Animated progress
  const progressWidth = useSharedValue(0);
  useEffect(() => {
    progressWidth.value = withTiming((dlState?.progress ?? 0) * 100, { duration: 150 });
  }, [dlState?.progress]);

  const animatedProgressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  // === Download ===
  const handleDownload = () => {
    setShowDetail(false);
    startDownload(game, romDir, emulator.romExtension);
  };

  const handlePress = () => {
    if (isActive) return;
    if (downloaded) return;
    if (isError) {
      retryDownload(game.id);
      return;
    }
    // Show detail alert
    setShowDetail(true);
  };

  // === Card border color ===
  const borderClass = downloaded
    ? 'border-green-500/30'
    : isError
    ? 'border-red-500/30'
    : isActive
    ? 'border-retro-blue/30'
    : 'border-white/10';

  const bgClass = downloaded ? 'bg-green-500/5' : 'bg-white/5';

  return (
    <>
      <Animated.View entering={FadeInUp.delay(index * 40).duration(250)}>
        <View
          className={`flex-row items-center ${bgClass} rounded-2xl overflow-hidden border ${borderClass} mb-3`}
          style={{ opacity: downloaded ? 0.6 : 1 }}
        >
          {/* Game info (Press to show detail) */}
          <TouchableOpacity
            onPress={handlePress}
            disabled={!!isActive || downloaded}
            activeOpacity={0.85}
            className="flex-1 px-3 py-2.5"
          >
            <Text className="text-white text-base font-bold mb-0.5" numberOfLines={1}>
              {game.name}
            </Text>
            <Text className="text-white/40 text-[11px] mb-2">
              {formatSize(game.size)} • {game.platform.toUpperCase()}
            </Text>

            {/* Status area */}
            {isActive ? (
              <View>
                <View className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-1">
                  <Animated.View
                    style={animatedProgressStyle}
                    className="h-full bg-retro-blue rounded-full"
                  />
                </View>
                <View className="flex-row items-center justify-between">
                  <Text className="text-retro-blue text-[10px] font-bold">
                    {dlState.status === 'extracting'
                      ? 'Đang giải nén...'
                      : `Đang tải ${Math.round((dlState.progress ?? 0) * 100)}%`}
                  </Text>
                  {dlState.speed > 0 && dlState.status === 'downloading' && (
                    <Text className="text-white/30 text-[10px]">{formatSpeed(dlState.speed)}</Text>
                  )}
                </View>
              </View>
            ) : isError ? (
              <View className="flex-row items-center">
                <RotateCcw size={11} color="#f87171" />
                <Text className="text-red-400 text-[11px] font-bold ml-1">
                  Lỗi — nhấn thử lại
                </Text>
              </View>
            ) : downloaded ? (
              <View className="flex-row items-center">
                <CheckCircle2 size={12} color="#22c55e" />
                <Text className="text-green-400 text-[11px] font-bold ml-1">Sẵn sàng chơi</Text>
              </View>
            ) : (
              <View className="flex-row items-center">
                <Info size={12} color="#00f2ff" />
                <Text className="text-retro-blue text-[11px] font-bold ml-1">Nhấn để xem</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Action button (Quick download) */}
          <View className="pr-3">
            {isActive ? (
              <TouchableOpacity
                onPress={() => cancelDownload(game.id)}
                className="w-10 h-10 rounded-full bg-white/10 items-center justify-center"
              >
                <X size={16} color="#ffffff80" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={isError ? () => retryDownload(game.id) : handleDownload}
                disabled={downloaded}
                activeOpacity={0.8}
                className={`w-10 h-10 rounded-full items-center justify-center ${
                  isError ? 'bg-red-500/20' : downloaded ? 'bg-green-500' : 'bg-retro-blue'
                }`}
              >
                {isError ? (
                  <RotateCcw size={18} color="#f87171" />
                ) : downloaded ? (
                  <CheckCircle2 size={18} color="white" />
                ) : (
                  <DownloadCloud size={18} color="black" />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Animated.View>

      {/* Game Detail Alert */}
      <CustomAlert
        visible={showDetail}
        title={game.name}
        message={`Hệ máy: ${emulator.title}\nDung lượng: ${formatSize(game.size)}\nFile: ${game.filename}`}
        confirmText="Tải game"
        cancelText="Đóng"
        confirmColor="#00f2ff"
        onConfirm={handleDownload}
        onCancel={() => setShowDetail(false)}
      />
    </>
  );
};

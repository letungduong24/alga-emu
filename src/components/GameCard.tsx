import React, { useEffect } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { DownloadCloud, Play, Loader2, CheckCircle2 } from 'lucide-react-native';
import { useGameDownload } from '@/hooks/useGameDownload';
import { Game } from '@/constants/games';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

interface GameCardProps {
  game: Game;
  index: number;
}

export const GameCard = ({ game, index }: GameCardProps) => {
  const {
    isDownloaded,
    isDownloading,
    progress,
    downloadGame,
    launchGame,
    checkDownloaded,
  } = useGameDownload(game);

  useEffect(() => {
    checkDownloaded();
  }, []);

  const progressWidth = useSharedValue(0);
  useEffect(() => {
    progressWidth.value = withTiming(progress * 100, { duration: 100 });
  }, [progress]);

  const animatedProgressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  const handlePress = () => {
    if (isDownloading) return;
    if (isDownloaded) {
      launchGame();
    } else {
      downloadGame();
    }
  };

  return (
    <Animated.View entering={FadeInUp.delay(index * 120).duration(400)}>
      <TouchableOpacity
        onPress={handlePress}
        disabled={isDownloading}
        activeOpacity={0.85}
        className="flex-row items-center bg-white/5 rounded-2xl overflow-hidden border border-white/10 mb-4"
      >
        {/* Ảnh bìa game */}
        <Image
          source={game.image}
          className="w-28 h-28"
          resizeMode="cover"
        />

        {/* Thông tin game */}
        <View className="flex-1 px-4 py-3">
          <Text className="text-white text-lg font-bold mb-1" numberOfLines={1}>
            {game.title}
          </Text>
          <Text className="text-white/50 text-xs mb-3" numberOfLines={2}>
            {game.description}
          </Text>

          {/* Trạng thái + Thanh tiến trình */}
          {isDownloading ? (
            <View>
              <View className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-1">
                <Animated.View
                  style={animatedProgressStyle}
                  className="h-full bg-retro-blue rounded-full"
                />
              </View>
              <Text className="text-retro-blue text-[10px] font-bold">
                {progress < 0.9 ? `Đang tải ${Math.round(progress * 100)}%` : 'Đang giải nén...'}
              </Text>
            </View>
          ) : isDownloaded ? (
            <View className="flex-row items-center">
              <CheckCircle2 size={14} color="#22c55e" />
              <Text className="text-green-400 text-xs font-bold ml-1">Sẵn sàng</Text>
            </View>
          ) : (
            <View className="flex-row items-center">
              <DownloadCloud size={14} color="#00f2ff" />
              <Text className="text-retro-blue text-xs font-bold ml-1">Nhấn để tải</Text>
            </View>
          )}
        </View>

        {/* Nút hành động */}
        <View className="pr-4">
          <View
            className={`w-12 h-12 rounded-full items-center justify-center ${
              isDownloading ? 'bg-white/5' : isDownloaded ? 'bg-green-500' : 'bg-retro-blue'
            }`}
          >
            {isDownloading ? (
              <Loader2 size={22} color="#00f2ff" />
            ) : isDownloaded ? (
              <Play size={22} color="white" fill="white" />
            ) : (
              <DownloadCloud size={22} color="black" />
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

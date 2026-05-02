import React, { useState, useRef, useMemo } from 'react';
import { View, Text, FlatList, Image, StatusBar, ImageBackground, useWindowDimensions, ScrollView as RNScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { EmulatorCard } from '@/components/EmulatorCard';
import { EMULATORS } from '@/constants/emulators';
import { GAME_LIBRARY } from '@/constants/games';
import { Search, Info, User } from 'lucide-react-native';
import { useRetroArch, useCore } from '@/hooks/useEmulator';
import Animated, { 
  FadeIn, 
  FadeInDown, 
} from 'react-native-reanimated';

// Card cho mỗi hệ máy trong carousel
const EmulatorItem = ({ emulator, isSelected, onFocus, onAction, retroArchInstalled }: any) => {
  const { isCoreReady, isDownloading, progress, downloadCore } = useCore(emulator.coreName, emulator.coreUrl);

  const handlePress = () => {
    if (!isSelected) {
      onFocus();
      return;
    }
    if (!retroArchInstalled) return; // Cần cài RetroArch trước
    if (isCoreReady) {
      onAction(emulator.id);
    } else {
      downloadCore();
    }
  };

  return (
    <EmulatorCard
      image={emulator.image}
      isSelected={isSelected}
      isDownloading={isDownloading}
      progress={progress}
      onPress={handlePress}
    />
  );
};

export default function HomeScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const selectedEmulator = EMULATORS[selectedIndex];
  
  // RetroArch status (chung cho tất cả)
  const { isInstalled: retroArchInstalled, isDownloading: retroDownloading, progress: retroProgress, downloadAndInstall: installRetroArch } = useRetroArch();
  
  // Core status cho emulator đang chọn
  const { isCoreReady, isDownloading: coreDownloading, progress: coreProgress, downloadCore } = useCore(selectedEmulator.coreName, selectedEmulator.coreUrl);
  
  const hasGames = (GAME_LIBRARY[selectedEmulator.id]?.length ?? 0) > 0;

  const goToGames = (emulatorId: string) => {
    router.push({ pathname: '/games', params: { emulatorId } });
  };

  const isLandscape = width > height;
  const carouselPadding = useMemo(() => (width - 180) / 2, [width]);

  const handleFocus = (index: number) => {
    if (index === selectedIndex) return;
    setSelectedIndex(index);
  };

  const onScrollEnd = (e: any) => {
    const x = e.nativeEvent.contentOffset.x;
    const index = Math.round(x / 204);
    if (index >= 0 && index < EMULATORS.length) {
      setSelectedIndex(index);
    }
  };

  // Xác định trạng thái nút chính
  const getButtonState = () => {
    if (!retroArchInstalled) {
      return {
        label: retroDownloading ? `Tải RetroArch ${Math.round(retroProgress * 100)}%` : 'Cài RetroArch',
        onPress: installRetroArch,
        disabled: retroDownloading,
      };
    }
    if (!isCoreReady) {
      return {
        label: coreDownloading ? `Tải Core ${Math.round(coreProgress * 100)}%` : 'Tải Core',
        onPress: downloadCore,
        disabled: coreDownloading,
      };
    }
    return {
      label: hasGames ? 'Xem Game' : 'Sẵn sàng ✓',
      onPress: () => goToGames(selectedEmulator.id),
      disabled: !hasGames,
    };
  };

  const buttonState = getButtonState();

  return (
    <View className="flex-1 bg-black">
      <StatusBar hidden />

      {/* Background */}
      <Animated.View entering={FadeIn.duration(800)} className="absolute inset-0">
        <ImageBackground
          source={selectedEmulator.image}
          className="w-full h-full"
          blurRadius={25}
        >
          <View className="absolute inset-0 bg-black/50" />
        </ImageBackground>
      </Animated.View>

      {/* Top Navbar */}
      <View 
        style={{ paddingTop: insets.top }}
        className="flex-row justify-between items-center px-6 py-3"
      >
        <View className="flex-row items-center">
          <Text className="text-white text-2xl font-black tracking-tighter mr-2">ALGA</Text>
          {retroArchInstalled && (
            <View className="bg-green-500/20 px-2 py-0.5 rounded-full border border-green-500/40">
              <Text className="text-green-400 text-[10px] font-bold">RetroArch ✓</Text>
            </View>
          )}
        </View>

        <View className="flex-row items-center">
          <RNScrollView horizontal showsHorizontalScrollIndicator={false}>
            {CATEGORIES.map((cat, i) => (
              <Text key={i} className="text-white/60 text-sm font-medium mx-3">
                {cat}
              </Text>
            ))}
          </RNScrollView>
        </View>

        <View className="flex-row items-center gap-x-5 ml-2">
          <Search size={18} color="white" opacity={0.6} />
          <Info size={18} color="white" opacity={0.6} />
        </View>
      </View>

      {/* Main Carousel Area */}
      <View className="flex-1 justify-center py-4">
        <FlatList
          ref={flatListRef}
          data={EMULATORS}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ 
            paddingHorizontal: carouselPadding,
            alignItems: 'center' 
          }}
          snapToInterval={204}
          decelerationRate="fast"
          onMomentumScrollEnd={onScrollEnd}
          onScrollToIndexFailed={() => {}}
          renderItem={({ item, index }) => (
            <EmulatorItem
              emulator={item}
              isSelected={index === selectedIndex}
              onFocus={() => {
                flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
                setSelectedIndex(index);
              }}
              onAction={goToGames}
              retroArchInstalled={retroArchInstalled}
            />
          )}
        />
      </View>

      {/* Focused Item Info Area */}
      <View 
        style={{ paddingBottom: insets.bottom + 16 }}
        className={`px-8 ${isLandscape ? 'absolute bottom-0 left-0 right-0' : ''}`}
      >
        <Animated.View 
          key={`info-${selectedEmulator.id}`}
          entering={FadeInDown.duration(500)}
        >
          <Text 
            className={`text-white font-bold tracking-tighter mb-2 ${isLandscape ? 'text-5xl' : 'text-3xl'}`}
          >
            {selectedEmulator.title}
          </Text>
          
          <Text className="text-white/60 text-sm mb-6 max-w-md">
            {selectedEmulator.description}
          </Text>

          {/* Main Action Button */}
          <View className="flex-row items-center gap-x-4">
             <TouchableOpacity 
                onPress={buttonState.onPress}
                disabled={buttonState.disabled}
                className={`px-10 py-4 rounded-full shadow-xl min-w-[160px] items-center ${
                  retroArchInstalled && isCoreReady ? 'bg-white shadow-white/30' : 'bg-retro-blue shadow-retro-blue/30'
                }`}
             >
                <Text className={`font-extrabold text-lg ${
                  retroArchInstalled && isCoreReady ? 'text-black' : 'text-black'
                }`}>
                  {buttonState.label}
                </Text>
             </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const CATEGORIES = ['Store', 'Game của tôi', 'Media', 'Thư viện', 'Cài đặt'];

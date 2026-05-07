import { CustomAlert } from '@/components/CustomAlert';
import { EmulatorCard } from '@/components/EmulatorCard';
import { FocusableView } from '@/components/FocusableView';
import { EMULATORS } from '@/constants/emulators';
import { useCore } from '@/hooks/useEmulator';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, FlatList, ImageBackground, StatusBar, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Animated, {
    FadeIn,
    FadeInDown,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { checkStoragePermission, requestStoragePermission } from '../../modules/app-launcher';

// Card cho mỗi hệ máy trong carousel
const EmulatorItem = ({ emulator, isSelected, onFocus, onAction, cardSize }: any) => {
  const { isCoreReady, isDownloading, progress, downloadCore } = useCore(emulator.coreName, emulator.coreUrl);

  const handlePress = () => {
    if (!isSelected) {
      onFocus();
      return;
    }
    // Navigate to library — will auto-download core if needed
    onAction(emulator.id);
  };

  return (
    <FocusableView
      id={`emulator-card-${emulator.id}`}
      onAction={() => onAction(emulator.id)}
      onFocus={onFocus}
      priority={isSelected ? 1 : 0}
    >
      <EmulatorCard
        image={emulator.image}
        isSelected={isSelected}
        isDownloading={isDownloading}
        progress={progress}
        onPress={handlePress}
        size={cardSize}
      />
    </FocusableView>
  );
};

export default function HomeScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const [showPermissionAlert, setShowPermissionAlert] = useState(false);

  // === Storage Permission Check ===
  const recheckPermission = useCallback(async () => {
    try {
      const granted = await checkStoragePermission();
      setShowPermissionAlert(!granted);
    } catch {}
  }, []);

  useEffect(() => {
    recheckPermission();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') recheckPermission();
    });
    return () => sub.remove();
  }, [recheckPermission]);

  const selectedEmulator = EMULATORS[selectedIndex];
  
  const { isCoreReady, isDownloading: coreDownloading, progress: coreProgress, downloadCore } = useCore(selectedEmulator.coreName, selectedEmulator.coreUrl);

  const goToLibrary = (emulatorId: string) => {
    router.push({ pathname: '/library', params: { emulatorId } });
  };

  const isLandscape = width > height;
  const cardSize = isLandscape ? 160 : 180;
  const snapInterval = cardSize + 24; // card + margin
  // In landscape, carousel is flex-1 (half screen). Show adjacent cards by using smaller padding.
  const carouselPadding = useMemo(() => {
    if (isLandscape) {
      const carouselWidth = width * 0.5;
      return (carouselWidth - cardSize) / 2;
    }
    return (width - cardSize) / 2;
  }, [width, isLandscape, cardSize]);

  const handleFocus = (index: number) => {
    if (index === selectedIndex) return;
    setSelectedIndex(index);
  };

  const onScrollEnd = (e: any) => {
    const x = e.nativeEvent.contentOffset.x;
    const index = Math.round(x / snapInterval);
    if (index >= 0 && index < EMULATORS.length) {
      setSelectedIndex(index);
    }
  };

  // Xác định trạng thái nút chính
  const getButtonState = () => {
    if (!isCoreReady) {
      return {
        label: coreDownloading ? `Tải Core ${Math.round(coreProgress * 100)}%` : 'Tải Core',
        onPress: downloadCore,
        disabled: coreDownloading,
        style: 'bg-retro-blue',
      };
    }
    return {
      label: 'Mở thư viện',
      onPress: () => goToLibrary(selectedEmulator.id),
      disabled: false,
      style: 'bg-white',
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
          <Text className="text-white text-2xl font-black tracking-tighter">ALGA</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/settings')}
          className="px-3 py-1.5 rounded-full bg-white/10 border border-white/20"
        >
          <Text className="text-white text-xs font-semibold">Cài đặt</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content — side-by-side in landscape */}
      <View className={`flex-1 ${isLandscape ? 'flex-row' : ''}`}>
        {/* Carousel Area */}
        <View className={`justify-center ${isLandscape ? 'flex-1' : 'flex-1 py-4'}`}>
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
            snapToInterval={snapInterval}
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
                onAction={goToLibrary}
                cardSize={cardSize}
              />
            )}
          />
        </View>

        {/* Info Area */}
        <View 
          style={{ paddingBottom: insets.bottom + 16 }}
          className={`px-8 ${isLandscape ? 'flex-1 justify-center' : ''}`}
        >
          <Animated.View 
            key={`info-${selectedEmulator.id}`}
            entering={FadeInDown.duration(500)}
          >
            <Text 
              className={`text-white font-bold tracking-tighter mb-2 ${isLandscape ? 'text-3xl' : 'text-3xl'}`}
            >
              {selectedEmulator.title}
            </Text>
            
            <Text className="text-white/60 text-sm mb-6 max-w-md">
              {selectedEmulator.description}
            </Text>

            {/* Main Action Button */}
            <View className="flex-row items-center gap-x-4">
               <FocusableView
                  id="home-action-button"
                  onAction={buttonState.onPress}
                  disabled={buttonState.disabled}
                  priority={2}
               >
                  <TouchableOpacity 
                     onPress={buttonState.onPress}
                     disabled={buttonState.disabled}
                     className={`px-10 py-4 rounded-full shadow-xl min-w-[160px] items-center ${buttonState.style}`}
                  >
                     <Text className="text-black font-extrabold text-lg">
                       {buttonState.label}
                     </Text>
                  </TouchableOpacity>
               </FocusableView>
            </View>
          </Animated.View>
        </View>
      </View>

      {/* Storage Permission Alert */}
      <CustomAlert
        visible={showPermissionAlert}
        title="Cấp quyền truy cập"
        message={"Alga cần quyền \"Truy cập mọi tệp\" để tải và quản lý ROM game.\n\nNhấn \"Cấp quyền\" để mở Cài đặt."}
        confirmText="Cấp quyền"
        cancelText="Để sau"
        confirmColor="#00f2ff"
        onConfirm={async () => {
          setShowPermissionAlert(false);
          await requestStoragePermission();
        }}
        onCancel={() => setShowPermissionAlert(false)}
      />
    </View>
  );
}

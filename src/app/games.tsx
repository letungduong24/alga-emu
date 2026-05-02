import React from 'react';
import { View, Text, FlatList, StatusBar, ImageBackground, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EMULATORS } from '@/constants/emulators';
import { GAME_LIBRARY } from '@/constants/games';
import { GameCard } from '@/components/GameCard';
import { ArrowLeft, Gamepad2 } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

export default function GamesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { emulatorId } = useLocalSearchParams<{ emulatorId: string }>();

  const emulator = EMULATORS.find((e) => e.id === emulatorId);
  const games = GAME_LIBRARY[emulatorId ?? ''] ?? [];

  if (!emulator) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <Text className="text-white">Không tìm thấy hệ máy</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <StatusBar hidden />

      {/* Background */}
      <Animated.View entering={FadeIn.duration(800)} className="absolute inset-0">
        <ImageBackground
          source={emulator.image}
          className="w-full h-full"
          blurRadius={30}
        >
          <View className="absolute inset-0 bg-black/60" />
        </ImageBackground>
      </Animated.View>

      {/* Header */}
      <View
        style={{ paddingTop: insets.top + 12 }}
        className="px-6 pb-4 flex-row items-center"
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-white/10 items-center justify-center mr-4 border border-white/10"
        >
          <ArrowLeft size={20} color="white" />
        </TouchableOpacity>

        <View className="flex-1">
          <Animated.Text
            entering={FadeInDown.duration(400)}
            className="text-white text-2xl font-bold tracking-tight"
          >
            {emulator.title}
          </Animated.Text>
          <Text className="text-white/50 text-xs mt-0.5">
            {games.length} game có sẵn
          </Text>
        </View>

        <View className="w-10 h-10 rounded-full bg-retro-blue/20 items-center justify-center border border-retro-blue/30">
          <Gamepad2 size={20} color="#00f2ff" />
        </View>
      </View>

      {/* Danh sách game */}
      <FlatList
        data={games}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 12,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => <GameCard game={item} index={index} />}
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <Gamepad2 size={48} color="#ffffff" opacity={0.2} />
            <Text className="text-white/30 text-lg font-bold mt-4">Chưa có game nào</Text>
            <Text className="text-white/20 text-sm mt-1">Đang cập nhật...</Text>
          </View>
        }
      />
    </View>
  );
}

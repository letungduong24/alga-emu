import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StatusBar,
  ImageBackground,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EMULATORS } from '@/constants/emulators';
import { ArrowLeft, Search, ChevronLeft, ChevronRight, Gamepad2 } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useGameApi } from '@/hooks/useGameApi';
import { ApiGameCard } from '@/components/ApiGameCard';
import { useDownloadManager } from '@/hooks/useDownloadManager';

export default function StoreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { emulatorId } = useLocalSearchParams<{ emulatorId: string }>();
  const [searchText, setSearchText] = useState('');

  const emulator = EMULATORS.find((e) => e.id === emulatorId);
  const { downloadedGameIds, scanDownloaded } = useDownloadManager();

  const platformMap: Record<string, string> = {
    melonds: 'nds',
    citra: '3ds',
    mgba: 'gba',
  };
  const platform = platformMap[emulatorId ?? ''] ?? 'nds';

  const { games, total, page, totalPages, loading, fetching, error, search, goToPage } =
    useGameApi(platform);

  const handleSearch = useCallback(() => {
    search(searchText);
  }, [searchText, search]);

  // Scan downloaded games when game list loads
  useEffect(() => {
    if (games.length > 0 && emulator) {
      scanDownloaded(games, emulator.id, emulator.romExtension);
    }
  }, [games, emulator]);

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
        className="px-6 pb-3 flex-row items-center"
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
            Tải thêm game
          </Animated.Text>
          <Text className="text-white/50 text-xs mt-0.5">
            {total} game có sẵn • {emulator.title}
          </Text>
        </View>

        <View className="w-10 h-10 rounded-full bg-retro-blue/20 items-center justify-center border border-retro-blue/30">
          <Gamepad2 size={20} color="#00f2ff" />
        </View>
      </View>

      {/* Search Bar */}
      <View className="px-6 pb-3">
        <View className="flex-row items-center bg-white/10 rounded-xl border border-white/10 px-4 h-12">
          <Search size={18} color="#ffffff80" />
          <TextInput
            className="flex-1 text-white text-sm ml-3"
            placeholder="Tìm game..."
            placeholderTextColor="#ffffff50"
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchText.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchText('');
                search('');
              }}
            >
              <Text className="text-white/50 text-xs font-bold">✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Loading */}
      {loading && (
        <View className="items-center py-4">
          <ActivityIndicator color="#00f2ff" />
        </View>
      )}

      {/* Error */}
      {error && (
        <View className="px-6 py-3">
          <Text className="text-red-400 text-sm text-center">{error}</Text>
        </View>
      )}

      {/* Game List */}
      <View className="flex-1">
        <FlatList
          data={games}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 4,
            paddingBottom: insets.bottom + 80,
          }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <ApiGameCard game={item} emulator={emulator} index={index} />
          )}
          ListEmptyComponent={
            !loading ? (
              <View className="items-center justify-center py-20">
                <Gamepad2 size={48} color="#ffffff" opacity={0.2} />
                <Text className="text-white/30 text-lg font-bold mt-4">
                  {error ? 'Lỗi kết nối' : 'Không tìm thấy game'}
                </Text>
                <Text className="text-white/20 text-sm mt-1">
                  {error ? 'Kiểm tra kết nối mạng' : 'Thử từ khóa khác'}
                </Text>
              </View>
            ) : null
          }
        />

        {/* Loading overlay khi chuyển trang */}
        {fetching && !loading && (
          <View className="absolute inset-0 bg-black/60 items-center justify-center">
            <View style={{ backgroundColor: 'rgba(30,30,30,0.95)' }} className="rounded-2xl px-8 py-5 items-center border border-white/30">
              <ActivityIndicator color="#00f2ff" size="large" />
              <Text className="text-white text-sm font-bold mt-3">Đang tải...</Text>
            </View>
          </View>
        )}
      </View>

      {/* Pagination */}
      {totalPages > 1 && (
        <View
          style={{ paddingBottom: insets.bottom + 8 }}
          className="absolute bottom-0 left-0 right-0 items-center py-3"
        >
          <View
            style={{
              backgroundColor: 'rgba(25,25,35,0.85)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.4,
              shadowRadius: 12,
              elevation: 16,
            }}
            className="flex-row items-center rounded-full px-2 py-1.5 border border-white/15"
          >
            <TouchableOpacity
              onPress={() => goToPage(page - 1)}
              disabled={page <= 1 || fetching}
              className={`w-9 h-9 rounded-full items-center justify-center ${
                page <= 1 ? 'opacity-30' : ''
              }`}
            >
              <ChevronLeft size={18} color="#ffffff" />
            </TouchableOpacity>

            <Text className="text-white text-sm font-bold mx-4">
              {page} / {totalPages}
            </Text>

            <TouchableOpacity
              onPress={() => goToPage(page + 1)}
              disabled={page >= totalPages || fetching}
              className={`w-9 h-9 rounded-full items-center justify-center ${
                page >= totalPages ? 'opacity-30' : ''
              }`}
            >
              <ChevronRight size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

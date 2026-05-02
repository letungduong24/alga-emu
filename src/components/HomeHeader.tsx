import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Settings, Gamepad2 } from 'lucide-react-native';

export const HomeHeader = () => {
  const insets = useSafeAreaInsets();

  return (
    <View 
      style={{ paddingTop: insets.top + 10 }}
      className="px-6 pb-6"
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <View className="w-10 h-10 bg-retro-blue rounded-lg items-center justify-center shadow-lg shadow-retro-blue/50">
            <Gamepad2 size={24} color="#0a0a0a" />
          </View>
          <View className="ml-3">
            <Text className="text-white text-3xl font-bold tracking-tighter retro-glow-blue">
              ALGA
            </Text>
            <Text className="text-retro-blue/70 text-xs font-medium uppercase tracking-widest">
              Trạm Trình Giả Lập
            </Text>
          </View>
        </View>
        
        <TouchableOpacity 
          className="w-12 h-12 items-center justify-center rounded-full card-glass"
          activeOpacity={0.7}
        >
          <Settings size={24} color="#00f2ff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

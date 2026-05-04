import React from 'react';
import { View, Image, TouchableOpacity, Text } from 'react-native';
import { Loader2 } from 'lucide-react-native';
import Animated, { 
  useAnimatedStyle, 
  withSpring, 
  interpolate,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';

interface EmulatorCardProps {
  image: any;
  isSelected: boolean;
  isDownloading: boolean;
  progress: number;
  onPress: () => void;
  size?: number;
}

export const EmulatorCard = ({ 
  image, 
  isSelected, 
  isDownloading,
  progress,
  onPress,
  size = 180,
}: EmulatorCardProps) => {
  
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  React.useEffect(() => {
    scale.value = withSpring(isSelected ? 1.1 : 1);
    glowOpacity.value = withTiming(isSelected ? 1 : 0, { duration: 200 });
  }, [isSelected]);

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    borderWidth: interpolate(glowOpacity.value, [0, 1], [0, 3]),
    borderColor: '#00f2ff',
  }));

  const animatedGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const progressValue = useSharedValue(0);
  React.useEffect(() => {
    progressValue.value = withTiming(progress, { duration: 100 });
  }, [progress]);

  const animatedProgressBarStyle = useAnimatedStyle(() => ({
    width: `${progressValue.value * 100}%`,
  }));

  return (
    <View className="mx-3 my-4">
      <TouchableOpacity 
        onPress={onPress}
        activeOpacity={0.9}
        disabled={isDownloading && !isSelected}
      >
        <Animated.View 
          style={[animatedCardStyle, { width: size, height: size }]}
          className="rounded-2xl overflow-hidden bg-white/5 border-white/10 relative"
        >
          <Image 
            source={image} 
            className="w-full h-full"
            resizeMode="cover"
          />
          
          {/* Focused Glow Layer */}
          <Animated.View 
            style={animatedGlowStyle}
            className="absolute inset-0 bg-retro-blue/10"
          />

          {/* Downloading UI */}
          {isDownloading && (
            <View className="absolute inset-0 bg-black/70 items-center justify-center p-4">
               <Loader2 size={32} color="#00f2ff" className="animate-spin mb-2" />
               <Text className="text-retro-blue text-[10px] font-bold mb-2">
                 {Math.round(progress * 100)}%
               </Text>
               <View className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <Animated.View 
                    style={animatedProgressBarStyle}
                    className="h-full bg-retro-blue"
                  />
               </View>
            </View>
          )}
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
};

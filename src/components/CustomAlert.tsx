import React from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

interface CustomAlertProps {
  visible: boolean;
  icon?: string;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

export const CustomAlert: React.FC<CustomAlertProps> = ({
  visible,
  icon,
  title,
  message,
  confirmText = 'Xác nhận',
  cancelText,
  confirmColor = '#ef4444',
  onConfirm,
  onCancel,
}) => {
  if (!visible) return null;

  const showCancel = !!cancelText && !!onCancel;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center px-8">
        <Animated.View
          entering={FadeIn.duration(200)}
          className="absolute top-0 bottom-0 left-0 right-0 bg-black/70"
        >
          <Pressable style={{ flex: 1 }} onPress={onCancel} />
        </Animated.View>

        <Animated.View
          entering={ZoomIn.duration(250)}
          style={{ backgroundColor: 'rgba(28,28,35,0.97)' }}
          className="w-full rounded-3xl p-6 border border-white/10 max-w-sm"
        >
          {icon ? (
            <View className="items-center mb-4">
              <Text style={{ fontSize: 40 }}>{icon}</Text>
            </View>
          ) : null}

          <Text className="text-white text-xl font-bold text-center mb-2">
            {title}
          </Text>

          <Text className="text-white/50 text-sm text-center mb-6 leading-5">
            {message}
          </Text>

          <View className="flex-row gap-x-3">
            {showCancel && (
              <TouchableOpacity
                onPress={onCancel}
                className="flex-1 py-3.5 rounded-xl bg-white/10 items-center border border-white/10"
              >
                <Text className="text-white/70 font-bold text-sm">{cancelText}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={onConfirm}
              style={{ backgroundColor: confirmColor }}
              className="flex-1 py-3.5 rounded-xl items-center"
            >
              <Text className="text-white font-bold text-sm">{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

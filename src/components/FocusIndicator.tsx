import { useGamepadContext } from '@/contexts/GamepadContext';
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

// ============================================================================
// FocusIndicator Component
// ============================================================================

export const FocusIndicator: React.FC = () => {
  const { state } = useGamepadContext();

  // Animated values
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  const opacity = useSharedValue(0);

  // ============================================================================
  // Update Position & Size
  // ============================================================================

  useEffect(() => {
    if (!state.isConnected || !state.focusedElementId) {
      // Hide indicator
      opacity.value = withTiming(0, { duration: 150 });
      return;
    }

    const focusedElement = state.elements.get(state.focusedElementId);
    if (!focusedElement) {
      opacity.value = withTiming(0, { duration: 150 });
      return;
    }

    const { bounds } = focusedElement;

    // Animate to new position and size
    x.value = withSpring(bounds.x, { damping: 18, stiffness: 160 });
    y.value = withSpring(bounds.y, { damping: 18, stiffness: 160 });
    width.value = withSpring(bounds.width, { damping: 18, stiffness: 160 });
    height.value = withSpring(bounds.height, { damping: 18, stiffness: 160 });

    // Show indicator
    opacity.value = withTiming(1, { duration: 100 });
  }, [
    state.isConnected,
    state.focusedElementId,
    state.elements,
  ]);

  // ============================================================================
  // Animated Style
  // ============================================================================

  const animatedStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x.value,
    top: y.value,
    width: width.value,
    height: height.value,
    opacity: opacity.value,
    borderWidth: 3,
    borderColor: state.config.indicatorColor,
    borderRadius: 12,
    shadowColor: state.config.indicatorColor,
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 10,
    pointerEvents: 'none',
  }));

  // ============================================================================
  // Render
  // ============================================================================

  return <Animated.View style={animatedStyle} />;
};

const styles = StyleSheet.create({
  // No static styles needed - all styles are animated
});

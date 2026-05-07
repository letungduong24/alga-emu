import { useGamepadFocus } from '@/hooks/useGamepadFocus';
import React, { forwardRef, useEffect, useRef } from 'react';
import { LayoutChangeEvent, View, ViewStyle } from 'react-native';

// ============================================================================
// Types
// ============================================================================

export interface FocusableViewProps {
  id: string;
  onFocus?: () => void;
  onBlur?: () => void;
  onAction?: () => void;
  disabled?: boolean;
  priority?: number;
  navigationGroup?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

// ============================================================================
// FocusableView Component
// ============================================================================

export const FocusableView = forwardRef<View, FocusableViewProps>(
  (
    {
      id,
      onFocus,
      onBlur,
      onAction,
      disabled = false,
      priority = 0,
      navigationGroup,
      children,
      style,
    },
    forwardedRef
  ) => {
    const internalRef = useRef<View>(null);
    const ref = (forwardedRef as React.RefObject<View>) || internalRef;

    const { isFocused, registerElement, unregisterElement, updateElementBounds } =
      useGamepadFocus(id);

    // ============================================================================
    // Register/Unregister Element
    // ============================================================================

    useEffect(() => {
      registerElement({
        id,
        ref,
        bounds: { x: 0, y: 0, width: 0, height: 0 },
        onFocus,
        onBlur,
        onAction,
        disabled,
        priority,
        navigationGroup,
      });

      return () => {
        unregisterElement(id);
      };
    }, [id, disabled, priority, navigationGroup]);

    // ============================================================================
    // Layout Measurement
    // ============================================================================

    const handleLayout = (event: LayoutChangeEvent) => {
      const { x, y, width, height } = event.nativeEvent.layout;

      // Measure absolute position on screen
      ref.current?.measureInWindow((pageX, pageY) => {
        updateElementBounds(id, {
          x: pageX,
          y: pageY,
          width,
          height,
        });
      });
    };

    // ============================================================================
    // Render
    // ============================================================================

    return (
      <View ref={ref} style={style} onLayout={handleLayout}>
        {children}
      </View>
    );
  }
);

FocusableView.displayName = 'FocusableView';

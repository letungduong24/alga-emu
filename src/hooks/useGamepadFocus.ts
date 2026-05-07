import { FocusableElement, useGamepadContext } from '@/contexts/GamepadContext';
import { useEffect, useState } from 'react';

export const useGamepadFocus = (elementId?: string) => {
  const { state, dispatch } = useGamepadContext();
  const [isFocused, setIsFocused] = useState(false);

  // Check if this element is focused
  useEffect(() => {
    if (elementId) {
      setIsFocused(state.focusedElementId === elementId);
    }
  }, [state.focusedElementId, elementId]);

  const registerElement = (element: FocusableElement) => {
    dispatch({ type: 'REGISTER_ELEMENT', payload: element });
  };

  const unregisterElement = (id: string) => {
    dispatch({ type: 'UNREGISTER_ELEMENT', payload: id });
  };

  const focusElement = (id: string) => {
    const element = state.elements.get(id);
    if (!element || element.disabled) return;

    // Call onBlur on previously focused element
    if (state.focusedElementId) {
      const prevElement = state.elements.get(state.focusedElementId);
      prevElement?.onBlur?.();
    }

    // Set new focus
    dispatch({ type: 'SET_FOCUSED_ELEMENT', payload: id });

    // Call onFocus on newly focused element
    element.onFocus?.();
  };

  const updateElementBounds = (id: string, bounds: any) => {
    dispatch({ type: 'UPDATE_ELEMENT_BOUNDS', payload: { id, bounds } });
  };

  return {
    isFocused,
    registerElement,
    unregisterElement,
    focusElement,
    updateElementBounds,
  };
};

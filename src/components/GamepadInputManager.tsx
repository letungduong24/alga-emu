import { useGamepadContext } from '@/contexts/GamepadContext';
import {
    findFirstFocusable,
    findNextFocusable,
    NavigationDirection
} from '@/utils/spatialNavigation';
import { useEffect, useRef } from 'react';
import { NativeEventEmitter, NativeModules } from 'react-native';

// ============================================================================
// Types
// ============================================================================

type GamepadAction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'ACTION' | 'BACK' | 'L1' | 'R1';

interface KeyEventData {
  keyCode: number;
  action: string;
  pressTime?: number;
}

// ============================================================================
// KeyCode Mapping
// ============================================================================

const KEYCODE_MAP: Record<number, GamepadAction> = {
  19: 'UP',        // KEYCODE_DPAD_UP
  20: 'DOWN',      // KEYCODE_DPAD_DOWN
  21: 'LEFT',      // KEYCODE_DPAD_LEFT
  22: 'RIGHT',     // KEYCODE_DPAD_RIGHT
  23: 'ACTION',    // KEYCODE_DPAD_CENTER
  96: 'ACTION',    // KEYCODE_BUTTON_A
  97: 'BACK',      // KEYCODE_BUTTON_B
  102: 'L1',       // KEYCODE_BUTTON_L1
  103: 'R1',       // KEYCODE_BUTTON_R1
  4: 'BACK',       // KEYCODE_BACK
};

// ============================================================================
// GamepadInputManager Component
// ============================================================================

export const GamepadInputManager: React.FC = () => {
  const { state, dispatch } = useGamepadContext();
  const lastKeyDownTime = useRef<number>(0);
  const lastKeyCode = useRef<number | null>(null);
  const repeatTimer = useRef<NodeJS.Timeout | null>(null);
  const connectionCheckTimer = useRef<NodeJS.Timeout | null>(null);
  const eventQueue = useRef<GamepadAction[]>([]);
  const isProcessing = useRef<boolean>(false);

  // ============================================================================
  // Event Processing (60Hz throttle)
  // ============================================================================

  const processEventQueue = () => {
    if (isProcessing.current || eventQueue.current.length === 0) return;

    isProcessing.current = true;
    const action = eventQueue.current.shift();

    if (action) {
      handleGamepadAction(action);
    }

    isProcessing.current = false;

    // Process next event after 16.67ms (60Hz)
    if (eventQueue.current.length > 0) {
      setTimeout(processEventQueue, 16.67);
    }
  };

  const queueEvent = (action: GamepadAction) => {
    // Prevent queue overflow (max 10 events)
    if (eventQueue.current.length >= 10) {
      eventQueue.current.shift(); // Drop oldest event
    }

    eventQueue.current.push(action);

    if (!isProcessing.current) {
      processEventQueue();
    }
  };

  // ============================================================================
  // Gamepad Action Handler
  // ============================================================================

  const handleGamepadAction = (action: GamepadAction) => {
    if (!state.config.enabled) return;

    console.log('[Gamepad] Action:', action);

    // Handle directional navigation
    if (action === 'UP' || action === 'DOWN' || action === 'LEFT' || action === 'RIGHT') {
      handleDirectionalNavigation(action as NavigationDirection);
      return;
    }

    // Handle action button
    if (action === 'ACTION') {
      handleActionButton();
      return;
    }

    // Handle back button
    if (action === 'BACK') {
      handleBackButton();
      return;
    }

    // Handle shoulder buttons (L1, R1)
    if (action === 'L1' || action === 'R1') {
      handleShoulderButton(action);
      return;
    }
  };

  // ============================================================================
  // Navigation Handlers
  // ============================================================================

  const handleDirectionalNavigation = (direction: NavigationDirection) => {
    // If no element is focused, focus the first one
    if (!state.focusedElementId) {
      const firstElement = findFirstFocusable(
        state.elements,
        state.isModalOpen ? 'modal' : undefined
      );

      if (firstElement) {
        dispatch({ type: 'SET_FOCUSED_ELEMENT', payload: firstElement.id });
        firstElement.onFocus?.();
      }
      return;
    }

    // Get currently focused element
    const currentElement = state.elements.get(state.focusedElementId);
    if (!currentElement) return;

    // Find next focusable element
    const nextElement = findNextFocusable(
      currentElement,
      direction,
      state.elements,
      state.isModalOpen ? 'modal' : undefined
    );

    if (nextElement) {
      // Call onBlur on current element
      currentElement.onBlur?.();

      // Set new focus
      dispatch({ type: 'SET_FOCUSED_ELEMENT', payload: nextElement.id });

      // Call onFocus on new element
      nextElement.onFocus?.();
    }
  };

  const handleActionButton = () => {
    if (!state.focusedElementId) return;

    const focusedElement = state.elements.get(state.focusedElementId);
    if (focusedElement && focusedElement.onAction) {
      focusedElement.onAction();
    }
  };

  const handleBackButton = () => {
    // TODO: Implement back navigation logic
    // - Close modal if open
    // - Navigate back in navigation stack
    // - Clear search if focused
    console.log('[Gamepad] Back button pressed');
  };

  const handleShoulderButton = (button: 'L1' | 'R1') => {
    // TODO: Implement shoulder button quick actions
    // - L1: Toggle view mode, jump to first item, previous page
    // - R1: Open download screen, jump to last item, next page
    console.log('[Gamepad] Shoulder button pressed:', button);
  };

  // ============================================================================
  // Connection Detection
  // ============================================================================

  const checkConnection = () => {
    const now = Date.now();
    const timeSinceLastInput = now - lastKeyDownTime.current;

    // If no input for 500ms, consider disconnected
    if (timeSinceLastInput > 500 && state.isConnected) {
      dispatch({ type: 'SET_CONNECTED', payload: false });
      console.log('[Gamepad] Disconnected');
    }
  };

  // ============================================================================
  // Button Repeat Logic
  // ============================================================================

  const startRepeating = (keyCode: number) => {
    const action = KEYCODE_MAP[keyCode];
    if (!action) return;

    repeatTimer.current = setInterval(() => {
      queueEvent(action);
    }, state.config.repeatRate);
  };

  const stopRepeating = () => {
    if (repeatTimer.current) {
      clearInterval(repeatTimer.current);
      repeatTimer.current = null;
    }
  };

  // ============================================================================
  // KeyEvent Handlers
  // ============================================================================

  const handleKeyDown = (event: KeyEventData) => {
    const { keyCode } = event;
    const action = KEYCODE_MAP[keyCode];

    if (!action) return; // Ignore unmapped keys

    const now = Date.now();
    lastKeyDownTime.current = now;

    // Detect connection
    if (!state.isConnected) {
      dispatch({ type: 'SET_CONNECTED', payload: true });
      console.log('[Gamepad] Connected');
    }

    // Handle new button press
    if (keyCode !== lastKeyCode.current) {
      lastKeyCode.current = keyCode;
      queueEvent(action);

      // Schedule repeat after initial delay
      stopRepeating();
      setTimeout(() => {
        if (lastKeyCode.current === keyCode) {
          startRepeating(keyCode);
        }
      }, state.config.initialDelay);
    }
  };

  const handleKeyUp = (event: KeyEventData) => {
    const { keyCode } = event;

    if (keyCode === lastKeyCode.current) {
      lastKeyCode.current = null;
      stopRepeating();
    }
  };

  // ============================================================================
  // Setup Event Listeners
  // ============================================================================

  useEffect(() => {
    const { KeyEvent } = NativeModules;
    if (!KeyEvent) {
      console.warn('[Gamepad] react-native-keyevent not available');
      return;
    }

    const eventEmitter = new NativeEventEmitter(KeyEvent);

    const keyDownListener = eventEmitter.addListener('onKeyDown', handleKeyDown);
    const keyUpListener = eventEmitter.addListener('onKeyUp', handleKeyUp);

    // Start connection check timer
    connectionCheckTimer.current = setInterval(checkConnection, 500);

    console.log('[Gamepad] Input manager initialized');

    return () => {
      keyDownListener.remove();
      keyUpListener.remove();
      stopRepeating();
      if (connectionCheckTimer.current) {
        clearInterval(connectionCheckTimer.current);
      }
      console.log('[Gamepad] Input manager cleaned up');
    };
  }, [state.config.enabled, state.config.repeatRate, state.config.initialDelay]);

  return null; // This component doesn't render anything
};

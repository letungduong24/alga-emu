import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, RefObject, useContext, useEffect, useReducer } from 'react';
import { LayoutRectangle, View } from 'react-native';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface GamepadConfig {
  enabled: boolean;
  indicatorColor: string;
  repeatRate: number;              // ms between repeat events
  animationSpeed: number;          // ms for focus transitions
  initialDelay: number;            // ms before repeat starts
  enableHaptic: boolean;
}

export interface FocusableElement {
  id: string;
  ref: RefObject<View>;
  bounds: LayoutRectangle;
  onFocus?: () => void;
  onBlur?: () => void;
  onAction?: () => void;
  disabled?: boolean;
  priority?: number;
  navigationGroup?: string;
  screenId?: string;
}

export interface GamepadState {
  isConnected: boolean;
  focusedElementId: string | null;
  focusHistory: string[];
  isModalOpen: boolean;
  modalFocusableIds: string[];
  lastTouchTime: number;
  config: GamepadConfig;
  elements: Map<string, FocusableElement>;
}

type GamepadAction =
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'SET_FOCUSED_ELEMENT'; payload: string | null }
  | { type: 'PUSH_FOCUS_HISTORY'; payload: string }
  | { type: 'POP_FOCUS_HISTORY' }
  | { type: 'SET_MODAL_OPEN'; payload: boolean }
  | { type: 'SET_MODAL_FOCUSABLE_IDS'; payload: string[] }
  | { type: 'SET_LAST_TOUCH_TIME'; payload: number }
  | { type: 'UPDATE_CONFIG'; payload: Partial<GamepadConfig> }
  | { type: 'REGISTER_ELEMENT'; payload: FocusableElement }
  | { type: 'UNREGISTER_ELEMENT'; payload: string }
  | { type: 'UPDATE_ELEMENT_BOUNDS'; payload: { id: string; bounds: LayoutRectangle } };

// ============================================================================
// Default Config
// ============================================================================

const DEFAULT_CONFIG: GamepadConfig = {
  enabled: true,
  indicatorColor: '#00f2ff',
  repeatRate: 150,
  animationSpeed: 200,
  initialDelay: 400,
  enableHaptic: false,
};

const CONFIG_STORAGE_KEY = '@alga:gamepad-config';

// ============================================================================
// Initial State
// ============================================================================

const initialState: GamepadState = {
  isConnected: false,
  focusedElementId: null,
  focusHistory: [],
  isModalOpen: false,
  modalFocusableIds: [],
  lastTouchTime: 0,
  config: DEFAULT_CONFIG,
  elements: new Map(),
};

// ============================================================================
// Reducer
// ============================================================================

function gamepadReducer(state: GamepadState, action: GamepadAction): GamepadState {
  switch (action.type) {
    case 'SET_CONNECTED':
      return { ...state, isConnected: action.payload };

    case 'SET_FOCUSED_ELEMENT':
      return { ...state, focusedElementId: action.payload };

    case 'PUSH_FOCUS_HISTORY':
      return {
        ...state,
        focusHistory: [...state.focusHistory, action.payload],
      };

    case 'POP_FOCUS_HISTORY':
      const newHistory = [...state.focusHistory];
      newHistory.pop();
      return { ...state, focusHistory: newHistory };

    case 'SET_MODAL_OPEN':
      return { ...state, isModalOpen: action.payload };

    case 'SET_MODAL_FOCUSABLE_IDS':
      return { ...state, modalFocusableIds: action.payload };

    case 'SET_LAST_TOUCH_TIME':
      return { ...state, lastTouchTime: action.payload };

    case 'UPDATE_CONFIG':
      const newConfig = { ...state.config, ...action.payload };
      // Save to AsyncStorage
      AsyncStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(newConfig)).catch(console.error);
      return { ...state, config: newConfig };

    case 'REGISTER_ELEMENT':
      const newElements = new Map(state.elements);
      newElements.set(action.payload.id, action.payload);
      return { ...state, elements: newElements };

    case 'UNREGISTER_ELEMENT':
      const elementsAfterRemoval = new Map(state.elements);
      elementsAfterRemoval.delete(action.payload);
      return { ...state, elements: elementsAfterRemoval };

    case 'UPDATE_ELEMENT_BOUNDS':
      const element = state.elements.get(action.payload.id);
      if (!element) return state;
      const updatedElements = new Map(state.elements);
      updatedElements.set(action.payload.id, {
        ...element,
        bounds: action.payload.bounds,
      });
      return { ...state, elements: updatedElements };

    default:
      return state;
  }
}

// ============================================================================
// Context
// ============================================================================

interface GamepadContextValue {
  state: GamepadState;
  dispatch: React.Dispatch<GamepadAction>;
}

const GamepadContext = createContext<GamepadContextValue | undefined>(undefined);

// ============================================================================
// Provider
// ============================================================================

interface GamepadProviderProps {
  children: ReactNode;
  config?: Partial<GamepadConfig>;
}

export const GamepadProvider: React.FC<GamepadProviderProps> = ({ children, config }) => {
  const [state, dispatch] = useReducer(gamepadReducer, {
    ...initialState,
    config: { ...DEFAULT_CONFIG, ...config },
  });

  // Load config from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(CONFIG_STORAGE_KEY)
      .then((stored) => {
        if (stored) {
          const loadedConfig = JSON.parse(stored);
          dispatch({ type: 'UPDATE_CONFIG', payload: loadedConfig });
        }
      })
      .catch(console.error);
  }, []);

  return (
    <GamepadContext.Provider value={{ state, dispatch }}>
      {children}
    </GamepadContext.Provider>
  );
};

// ============================================================================
// Hooks
// ============================================================================

export const useGamepadContext = () => {
  const context = useContext(GamepadContext);
  if (!context) {
    throw new Error('useGamepadContext must be used within GamepadProvider');
  }
  return context;
};

export const useGamepad = () => {
  const { state, dispatch } = useGamepadContext();

  const updateConfig = (newConfig: Partial<GamepadConfig>) => {
    dispatch({ type: 'UPDATE_CONFIG', payload: newConfig });
  };

  return {
    isConnected: state.isConnected,
    config: state.config,
    updateConfig,
  };
};

import '../global.css';

import { FocusIndicator } from '@/components/FocusIndicator';
// import { GamepadInputManager } from '@/components/GamepadInputManager';
import { GamepadProvider } from '@/contexts/GamepadContext';
import { DownloadManagerProvider } from '@/hooks/useDownloadManager';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Slot } from 'expo-router';
import React from 'react';
import { useColorScheme } from 'react-native';

const queryClient = new QueryClient();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <QueryClientProvider client={queryClient}>
      <DownloadManagerProvider>
        <GamepadProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            {/* <GamepadInputManager /> */}
            <Slot />
            <FocusIndicator />
          </ThemeProvider>
        </GamepadProvider>
      </DownloadManagerProvider>
    </QueryClientProvider>
  );
}

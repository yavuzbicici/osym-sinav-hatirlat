import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useMemo } from 'react';

import { Colors } from '@/constants/theme';
import { AppThemeProvider, useColorScheme } from '@/hooks/use-color-scheme';
import { bootstrapAppNotifications } from '../lib/notifications/osym-preference-notifications';

export const unstable_settings = {
  anchor: '(tabs)',
};

function navigationTheme(scheme: 'light' | 'dark' | 'blue') {
  if (scheme === 'dark') return DarkTheme;
  if (scheme === 'blue') {
    return {
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        primary: Colors.blue.tint,
        background: Colors.blue.background,
        card: Colors.blue.background,
        text: Colors.blue.text,
        border: '#90caf9',
        notification: Colors.blue.tint,
      },
    };
  }
  return DefaultTheme;
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <RootLayoutInner />
    </AppThemeProvider>
  );
}

function RootLayoutInner() {
  const colorScheme = useColorScheme();
  const navTheme = useMemo(() => navigationTheme(colorScheme), [colorScheme]);

  useEffect(() => {
    let detach = () => {};
    (async () => {
      try {
        detach = await bootstrapAppNotifications();
      } catch (e) {
        console.warn('Notification scheduling failed', e);
      }
    })();
    return () => detach();
  }, []);

  return (
    <ThemeProvider value={navTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

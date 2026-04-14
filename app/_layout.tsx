import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { useEffect, useMemo } from 'react';
import * as Notifications from 'expo-notifications';

import { Colors } from '@/constants/theme';
import { AppThemeProvider, useColorScheme } from '@/hooks/use-color-scheme';
import {
  attachNotificationResponseListener,
  ensureNotificationCategory,
  flushPendingNotificationResponse,
  requestNotificationPermission,
  schedulePreferenceNotificationsDaily_13_25,
} from '../lib/notifications/osym-preference-notifications';

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
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });

        await ensureNotificationCategory();
        detach = attachNotificationResponseListener();
        await flushPendingNotificationResponse();

        const perm = await requestNotificationPermission();
        console.log('[notifications] permission granted:', perm.granted);
        if (!perm.granted) return;

        if (__DEV__) {
          try {
            const id = await Notifications.scheduleNotificationAsync({
              content: {
                title: 'Bildirim testi (1 sn)',
                body: 'Eğer bunu görüyorsan bildirim gösterimi çalışıyor. Seçenekler için bildirime basılı tut.',
                categoryIdentifier: 'osym_preference_reminder',
                data: { examId: 'dev' },
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                seconds: 1,
                repeats: false,
              },
            });
            console.log('[notifications] scheduled immediate test notification:', id);
          } catch (e) {
            console.warn('[notifications] immediate schedule failed', e);
          }
        }

        await schedulePreferenceNotificationsDaily_13_25();

        try {
          const scheduled = await Notifications.getAllScheduledNotificationsAsync();
          console.log('[notifications] scheduled count:', scheduled.length);
          if (scheduled.length) {
            console.log(
              '[notifications] first scheduled:',
              scheduled[0]?.content?.title,
              scheduled[0]?.content?.body,
              scheduled[0]?.trigger,
            );
          }
        } catch (e) {
          console.warn('[notifications] unable to read scheduled notifications', e);
        }
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

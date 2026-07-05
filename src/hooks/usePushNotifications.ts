import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import type * as NotificationsType from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { WorkerAPI } from '../api/endpoints';

// Push notifications aren't supported in Expo Go (removed in SDK 53+).
// We conditionally require the module so its side-effect code
// (which throws/warns immediately on import) never runs in Expo Go.
const isExpoGo = Constants.appOwnership === 'expo';

let Notifications: typeof NotificationsType | null = null;
if (!isExpoGo) {
  Notifications = require('expo-notifications');
  Notifications!.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Notifications || !Device.isDevice) {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E8730A',
    });
  }

  const tokenResponse = await Notifications.getDevicePushTokenAsync();
  return tokenResponse.data;
}

/**
 * Registers this device for push notifications once the worker is
 * authenticated, syncs the token to the backend, and routes to the
 * right screen when a notification (e.g. "New Job Available") is tapped.
 *
 * No-op inside Expo Go — push notifications require a development build.
 */
export function usePushNotifications(isAuthenticated: boolean) {
  const router = useRouter();
  const responseListener = useRef<NotificationsType.Subscription | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !Notifications) return;

    let cancelled = false;

    (async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (token && !cancelled) {
          await WorkerAPI.updateFcmToken(token);
        }
      } catch {
        // Non-fatal: app works fine without push, just no device token synced.
      }
    })();

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        | { bookingId?: string; type?: string }
        | undefined;
      if (data?.bookingId) {
        router.push({ pathname: '/job/[id]', params: { id: data.bookingId } });
      } else {
        router.push('/(tabs)/notifications');
      }
    });

    return () => {
      cancelled = true;
      responseListener.current?.remove();
    };
  }, [isAuthenticated]);
}

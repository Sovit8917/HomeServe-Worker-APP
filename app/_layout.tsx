import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator } from 'react-native';
import { AuthProvider, useAuth } from '../src/store/auth-context';
import { colors } from '../src/theme';
import { usePushNotifications } from '../src/hooks/usePushNotifications';

export const ONBOARDING_KEY = 'homeserve_worker_has_onboarded';

function RootNavigation() {
  const { isAuthenticated, isLoading, worker } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);

  usePushNotifications(isAuthenticated);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((v) => setHasOnboarded(v === 'true'));
  }, []);

  useEffect(() => {
    if (isLoading || hasOnboarded === null) return;

    const segs = segments as unknown as string[];
    const inAuthGroup = segs[0] === '(auth)';
    const onOnboarding = segs[0] === '(auth)' && segs[1] === 'onboarding';
    const onPendingApproval = segs[0] === 'pending-approval';

    if (!hasOnboarded) {
      if (!onOnboarding) router.replace('/(auth)/onboarding');
      return;
    }

    if (!isAuthenticated) {
      if (!inAuthGroup || onOnboarding) router.replace('/(auth)/login');
      return;
    }

    // Authenticated, but the admin hasn't approved this worker yet — keep
    // them out of the job-accepting flow until they're cleared.
    if (worker && worker.status !== 'APPROVED') {
      if (!onPendingApproval) router.replace('/pending-approval');
      return;
    }

    if (inAuthGroup || onPendingApproval) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, hasOnboarded, segments, worker?.status]);

  if (isLoading || hasOnboarded === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="pending-approval" />
      <Stack.Screen name="job/[id]" />
      <Stack.Screen name="job/chat" />
      <Stack.Screen name="job/track" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigation />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

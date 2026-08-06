import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { colors, fontSize, fontWeight, radius, shadow, spacing } from '../theme';
import Button from './Button';

interface PermissionsModalProps {
  visible: boolean;
  onComplete: () => void;
}

interface PermissionState {
  camera: boolean;
  photos: boolean;
  location: boolean;
  notifications: boolean;
}

export default function PermissionsModal({
  visible,
  onComplete,
}: PermissionsModalProps) {
  const [loading, setLoading] = useState(false);
  const [permissions, setPermissions] = useState<PermissionState>({
    camera: false,
    photos: false,
    location: false,
    notifications: false,
  });

  const checkStatus = async () => {
    try {
      const cameraRes = await ImagePicker.getCameraPermissionsAsync();
      const photosRes = await ImagePicker.getMediaLibraryPermissionsAsync();
      const locationRes = await Location.getForegroundPermissionsAsync();
      const notifRes = await Notifications.getPermissionsAsync();

      setPermissions({
        camera: cameraRes.granted,
        photos: photosRes.granted,
        location: locationRes.granted,
        notifications: notifRes.granted,
      });
    } catch (e) {
      console.log('Error checking permissions:', e);
    }
  };

  useEffect(() => {
    if (visible) {
      checkStatus();
    }
  }, [visible]);

  const requestAllPermissions = async () => {
    setLoading(true);
    try {
      // 1. Camera
      const camera = await ImagePicker.requestCameraPermissionsAsync();
      // 2. Photos
      const photos = await ImagePicker.requestMediaLibraryPermissionsAsync();
      // 3. Location
      const location = await Location.requestForegroundPermissionsAsync();
      // 4. Notifications
      const notif = await Notifications.requestPermissionsAsync();

      setPermissions({
        camera: camera.granted,
        photos: photos.granted,
        location: location.granted,
        notifications: notif.granted,
      });

      onComplete();
    } catch (e: any) {
      console.log('Error requesting permissions:', e);
      Alert.alert('Permissions Alert', 'Some permissions could not be requested. You can grant them in device settings.');
      onComplete();
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconHeader}>
            <Ionicons name="shield-checkmark" size={36} color={colors.primary} />
          </View>

          <Text style={styles.title}>Allow App Permissions</Text>
          <Text style={styles.subtitle}>
            To send job alerts, navigate to customers, and upload work proof photos, HomeServe needs access to:
          </Text>

          <View style={styles.permissionList}>
            <View style={styles.item}>
              <View style={[styles.itemIcon, permissions.camera && styles.itemIconGranted]}>
                <Ionicons
                  name="camera-outline"
                  size={20}
                  color={permissions.camera ? colors.success : colors.primary}
                />
              </View>
              <View style={styles.itemTextWrap}>
                <Text style={styles.itemTitle}>Camera Access</Text>
                <Text style={styles.itemSub}>Take live selfie & before/after work photos</Text>
              </View>
              {permissions.camera ? (
                <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              ) : null}
            </View>

            <View style={styles.item}>
              <View style={[styles.itemIcon, permissions.photos && styles.itemIconGranted]}>
                <Ionicons
                  name="images-outline"
                  size={20}
                  color={permissions.photos ? colors.success : colors.info}
                />
              </View>
              <View style={styles.itemTextWrap}>
                <Text style={styles.itemTitle}>Photos & Gallery</Text>
                <Text style={styles.itemSub}>Select document and profile pictures</Text>
              </View>
              {permissions.photos ? (
                <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              ) : null}
            </View>

            <View style={styles.item}>
              <View style={[styles.itemIcon, permissions.location && styles.itemIconGranted]}>
                <Ionicons
                  name="location-outline"
                  size={20}
                  color={permissions.location ? colors.success : colors.warning}
                />
              </View>
              <View style={styles.itemTextWrap}>
                <Text style={styles.itemTitle}>Location Services</Text>
                <Text style={styles.itemSub}>Receive nearby job requests & navigation</Text>
              </View>
              {permissions.location ? (
                <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              ) : null}
            </View>

            <View style={styles.item}>
              <View style={[styles.itemIcon, permissions.notifications && styles.itemIconGranted]}>
                <Ionicons
                  name="notifications-outline"
                  size={20}
                  color={permissions.notifications ? colors.success : colors.primary}
                />
              </View>
              <View style={styles.itemTextWrap}>
                <Text style={styles.itemTitle}>Push Notifications</Text>
                <Text style={styles.itemSub}>Get real-time job offers & customer chats</Text>
              </View>
              {permissions.notifications ? (
                <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              ) : null}
            </View>
          </View>

          <Button
            title="Allow All Permissions"
            onPress={requestAllPermissions}
            loading={loading}
            style={{ marginTop: spacing.lg }}
          />

          <Pressable style={styles.skipBtn} onPress={onComplete}>
            <Text style={styles.skipText}>Skip for now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    ...shadow.raised,
  },
  iconHeader: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.extrabold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  permissionList: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  itemIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  itemIconGranted: {
    backgroundColor: colors.successLight,
  },
  itemTextWrap: {
    flex: 1,
  },
  itemTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  itemSub: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  skipBtn: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  skipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
  },
});

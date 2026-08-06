import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert, Linking, Image, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, fontSize, fontWeight, spacing, radius } from '../../src/theme';
import { Card, StatusPill, statusTone, statusLabel, IconBadge } from '../../src/components/ui';
import Button from '../../src/components/Button';
import { JobsAPI, Job, UploadAPI } from '../../src/api/endpoints';

export default function JobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [uploadingStage, setUploadingStage] = useState<'before' | 'after' | null>(null);
  const [startModalVisible, setStartModalVisible] = useState(false);
  const [startOtp, setStartOtp] = useState('');
  const [startError, setStartError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await JobsAPI.getById(id);
      setJob(data.data);
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 403 || status === 404) {
        Alert.alert(
          'Job no longer available',
          'This request has already been taken by another worker or is no longer open.',
          [{ text: 'OK', onPress: () => router.back() }],
        );
      } else {
        Alert.alert('Could not load job', 'Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // The job is "over" once completed/cancelled/rejected. From this point the
  // backend has already stripped the customer's phone/email/exact address,
  // and we mirror that in the UI by never showing contact actions.
  const jobIsOver = job ? ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(job.status) : false;

  const runAction = async (action: () => Promise<any>, successMessage?: string) => {
    setActing(true);
    try {
      await action();
      if (successMessage) Alert.alert(successMessage);
      await load();
    } catch (e: any) {
      Alert.alert('Action failed', e?.response?.data?.message || 'Please try again.');
    } finally {
      setActing(false);
    }
  };

  const callCustomer = () => {
    if (job?.user?.phone) Linking.openURL(`tel:${job.user.phone}`);
  };

  const submitStartOtp = async () => {
    if (!job || startOtp.length !== 4) {
      setStartError('Enter the 4-digit code');
      return;
    }
    setStartError('');
    setActing(true);
    try {
      await JobsAPI.start(job.id, startOtp);
      setStartModalVisible(false);
      setStartOtp('');
      await load();
    } catch (e: any) {
      setStartError(e?.response?.data?.message || 'Incorrect code. Please try again.');
    } finally {
      setActing(false);
    }
  };

  // FIX: the ImagePicker permission/camera calls used to sit OUTSIDE the
  // try/catch. If launchCameraAsync threw (very common on real Android
  // devices), the error was silently swallowed - nothing happened on
  // screen and no error was shown. Everything is now inside one
  // try/catch/finally so any failure surfaces an Alert + console log.
  const uploadProof = async (stage: 'before' | 'after') => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Camera permission needed', 'Allow camera access to take a work-proof photo.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: false });
      if (result.canceled || !result.assets?.[0]) return;

      setUploadingStage(stage);

      const asset = result.assets[0];
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        name: `${stage}-${Date.now()}.jpg`,
        type: 'image/jpeg',
      } as any);

      const { data } = await UploadAPI.uploadImage(formData, 'proof');
      await JobsAPI.addWorkProof(job!.id, stage, [data.data.url]);
      await load();
    } catch (e: any) {
      console.log('uploadProof error:', e);
      Alert.alert('Upload failed', e?.response?.data?.message || e?.message || 'Please try again.');
    } finally {
      setUploadingStage(null);
    }
  };

  if (loading || !job) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxxl }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Job #{job.bookingNumber}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statusRow}>
          <StatusPill label={statusLabel(job.status)} tone={statusTone(job.status)} />
          <Text style={styles.amount}>₹{(job.finalAmount ?? job.total ?? 0).toFixed(0)}</Text>
        </View>

        {job.overdueFlaggedAt ? (
          <View style={styles.overdueBanner}>
            <Ionicons name="warning-outline" size={16} color={colors.danger} />
            <Text style={styles.overdueBannerText}>
              This job's scheduled time has passed. Please start it now, or contact support if you're delayed.
            </Text>
          </View>
        ) : null}

        <Card>
          <Text style={styles.sectionTitle}>Service</Text>
          {(job.items ?? []).map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={styles.itemName}>{item.service?.name}</Text>
              <Text style={styles.itemQty}>x{item.quantity}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.itemRow}>
            <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
            <Text style={styles.metaText}>
              {new Date(job.scheduledDate).toLocaleDateString()} · {job.scheduledTime}
            </Text>
          </View>
          {job.description ? (
            <View style={[styles.itemRow, { alignItems: 'flex-start' }]}>
              <Ionicons name="document-text-outline" size={16} color={colors.textMuted} />
              <Text style={styles.metaText}>{job.description}</Text>
            </View>
          ) : null}
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <Text style={styles.sectionTitle}>{jobIsOver ? 'Location' : 'Customer & location'}</Text>

          {!jobIsOver ? (
            <View style={styles.customerRow}>
              {job.user?.avatar ? (
                <Image source={{ uri: job.user.avatar }} style={styles.customerAvatar} />
              ) : (
                <IconBadge name="person" size={20} badgeSize={44} />
              )}
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.customerName}>{job.user?.name ?? 'Customer'}</Text>
                {job.user?.phone ? <Text style={styles.customerPhone}>{job.user.phone}</Text> : null}
              </View>
              {job.user?.phone ? (
                <Pressable onPress={callCustomer} style={styles.callBtn}>
                  <Ionicons name="call" size={18} color={colors.white} />
                </Pressable>
              ) : null}
            </View>
          ) : (
            <Text style={styles.privacyNote}>
              This job is closed, so the customer's contact details are no longer shown here.
            </Text>
          )}

          <View style={[styles.itemRow, { alignItems: 'flex-start', marginTop: spacing.sm }]}>
            <Ionicons name="location-outline" size={16} color={colors.textMuted} />
            <Text style={styles.metaText}>
              {jobIsOver ? job.address?.city ?? '—' : job.address?.fullAddress}
              {!jobIsOver && job.address?.landmark ? `\nLandmark: ${job.address.landmark}` : ''}
            </Text>
          </View>
        </Card>

        {!jobIsOver && (job.status === 'ACCEPTED' || job.status === 'IN_PROGRESS') ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
            <Button
              title="Navigate"
              variant="outline"
              icon={<Ionicons name="navigate-outline" size={18} color={colors.textPrimary} />}
              onPress={() => router.push({ pathname: '/job/track', params: { id: job.id } })}
              style={{ flex: 1 }}
            />
            <Button
              title="Message"
              variant="outline"
              icon={<Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.textPrimary} />}
              onPress={() => router.push({ pathname: '/job/chat', params: { id: job.id } })}
              style={{ flex: 1 }}
            />
          </View>
        ) : null}

        {!jobIsOver && (job.status === 'ACCEPTED' || job.status === 'IN_PROGRESS') ? (
          <Card style={{ marginTop: spacing.md }}>
            <Text style={styles.sectionTitle}>Work Proof Photos</Text>
            <Text style={styles.metaText}>
              Take a "before" photo when you arrive, and an "after" photo once the job is done —
              this protects you if a customer disputes the work later.
            </Text>

            <View style={{ marginTop: spacing.md }}>
              <Text style={[styles.itemQty, { marginBottom: spacing.xs }]}>Before</Text>
              <View style={styles.photoRow}>
                {(job.proofBeforePhotos ?? []).map((url, i) => (
                  <Image key={i} source={{ uri: url }} style={styles.photoThumb} />
                ))}
                <Pressable
                  style={styles.addPhotoBtn}
                  disabled={uploadingStage === 'before'}
                  onPress={() => uploadProof('before')}
                >
                  {uploadingStage === 'before' ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="camera-outline" size={22} color={colors.primary} />
                  )}
                </Pressable>
              </View>
            </View>

            {job.status === 'IN_PROGRESS' && (
              <View style={{ marginTop: spacing.md }}>
                <Text style={[styles.itemQty, { marginBottom: spacing.xs }]}>After</Text>
                <View style={styles.photoRow}>
                  {(job.proofAfterPhotos ?? []).map((url, i) => (
                    <Image key={i} source={{ uri: url }} style={styles.photoThumb} />
                  ))}
                  <Pressable
                    style={styles.addPhotoBtn}
                    disabled={uploadingStage === 'after'}
                    onPress={() => uploadProof('after')}
                  >
                    {uploadingStage === 'after' ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Ionicons name="camera-outline" size={22} color={colors.primary} />
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          </Card>
        ) : null}

        {job.payment ? (
          <Card style={{ marginTop: spacing.md }}>
            <Text style={styles.sectionTitle}>Payment</Text>
            <View style={styles.itemRow}>
              <Text style={styles.metaText}>Status</Text>
              <Text style={[styles.itemQty, { color: job.payment.status === 'PAID' ? colors.success : colors.warning }]}>
                {job.payment.status}
              </Text>
            </View>
            <View style={styles.itemRow}>
              <Text style={styles.metaText}>Method</Text>
              <Text style={styles.itemQty}>{job.payment.method}</Text>
            </View>
          </Card>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {job.status === 'PENDING' ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button
              title="Decline"
              variant="outline"
              style={{ flex: 1 }}
              disabled={acting}
              onPress={() =>
                Alert.alert('Decline job?', 'This request will be offered to another worker.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Decline', style: 'destructive', onPress: () => runAction(() => JobsAPI.reject(job.id)) },
                ])
              }
            />
            <Button
              title="Accept job"
              style={{ flex: 1 }}
              loading={acting}
              onPress={() => runAction(() => JobsAPI.accept(job.id))}
            />
          </View>
        ) : job.status === 'ACCEPTED' ? (
          <Button title="Start job" loading={acting} onPress={() => { setStartOtp(''); setStartError(''); setStartModalVisible(true); }} />
        ) : job.status === 'IN_PROGRESS' ? (
          <Button
            title="Mark as completed"
            loading={acting}
            onPress={() => {
              const hasAfterPhoto = (job.proofAfterPhotos ?? []).length > 0;
              Alert.alert(
                'Complete this job?',
                hasAfterPhoto
                  ? 'Make sure the work is finished before marking it complete.'
                  : "You haven't added an \"after\" photo yet — it helps protect you if the customer disputes the work later. Complete anyway?",
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Complete',
                    onPress: () =>
                      runAction(() => JobsAPI.complete(job.id), 'Job marked complete. Great work!'),
                  },
                ],
              );
            }}
          />
        ) : null}
      </View>

      <Modal
        visible={startModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStartModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="shield-checkmark-outline" size={28} color={colors.primary} />
            </View>
            <Text style={styles.modalTitle}>Enter Start Code</Text>
            <Text style={styles.modalSubtitle}>
              Ask the customer for the 4-digit code shown in their app to begin this job.
            </Text>
            <TextInput
              value={startOtp}
              onChangeText={(v) => {
                setStartOtp(v.replace(/[^0-9]/g, '').slice(0, 4));
                setStartError('');
              }}
              keyboardType="number-pad"
              maxLength={4}
              autoFocus
              placeholder="0000"
              placeholderTextColor={colors.textMuted}
              style={[styles.modalOtpInput, startError ? styles.modalOtpInputError : null]}
            />
            {startError ? <Text style={styles.modalErrorText}>{startError}</Text> : null}
            <Button title="Confirm & Start" loading={acting} onPress={submitStartOtp} style={{ marginTop: spacing.lg }} />
            <Pressable
              style={{ marginTop: spacing.md, alignItems: 'center' }}
              onPress={() => { setStartModalVisible(false); setStartOtp(''); setStartError(''); }}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  modalCard: {
    width: '100%', maxWidth: 360, backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.xl, alignItems: 'center',
  },
  modalIconWrap: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary, marginBottom: spacing.xs },
  modalSubtitle: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 20 },
  modalOtpInput: {
    width: 160, height: 56, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surfaceMuted, textAlign: 'center', fontSize: fontSize.xxl,
    fontWeight: fontWeight.extrabold, color: colors.textPrimary, letterSpacing: 8,
  },
  modalOtpInputError: { borderColor: colors.danger },
  modalErrorText: { color: colors.danger, fontSize: fontSize.xs, marginTop: spacing.sm, textAlign: 'center' },
  modalCancelText: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textPrimary },
  content: { padding: spacing.xxl, paddingTop: 0, gap: spacing.md, paddingBottom: spacing.xxxl },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  amount: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: colors.primary },
  overdueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  overdueBannerText: { flex: 1, fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.danger },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photoThumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  addPhotoBtn: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  sectionTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textMuted, textTransform: 'uppercase', marginBottom: spacing.sm },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  itemName: { fontSize: fontSize.md, color: colors.textPrimary, flex: 1 },
  itemQty: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.semibold },
  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: spacing.sm },
  metaText: { fontSize: fontSize.sm, color: colors.textSecondary, flex: 1 },
  customerRow: { flexDirection: 'row', alignItems: 'center' },
  customerAvatar: { width: 44, height: 44, borderRadius: 22 },
  customerName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  customerPhone: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  callBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  privacyNote: { fontSize: fontSize.sm, color: colors.textMuted, fontStyle: 'italic' },
  footer: { padding: spacing.xxl, borderTopWidth: 1, borderTopColor: colors.borderLight, backgroundColor: colors.surface },
});
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert, Linking, Image, Modal, TextInput, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, spacing, radius, shadow } from '../../src/theme';
import { Card, StatusPill, statusTone, statusLabel, IconBadge } from '../../src/components/ui';
import Button from '../../src/components/Button';
import { JobsAPI, Job, UploadAPI } from '../../src/api/endpoints';
import ImagePickerModal from '../../src/components/ImagePickerModal';
import ImageViewerModal from '../../src/components/ImageViewerModal';

export default function JobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [uploadingStage, setUploadingStage] = useState<'before' | 'after' | null>(null);
  const [pickerModalStage, setPickerModalStage] = useState<'before' | 'after' | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);
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

  const jobIsOver = job ? ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(job.status) : false;

  const runAction = async (action: () => Promise<any>, successMessage?: string) => {
    setActing(true);
    try {
      await action();
      if (successMessage) Alert.alert('Success', successMessage);
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
      setStartError(e?.response?.data?.message || 'Incorrect code. Please check customer app and try again.');
    } finally {
      setActing(false);
    }
  };

  const handleImagePicked = async (uri: string, stage: 'before' | 'after') => {
    if (!job) return;
    setUploadingStage(stage);
    try {
      const formData = new FormData();
      const filename = `${stage}-${Date.now()}.jpg`;
      formData.append('file', {
        uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
        name: filename,
        type: 'image/jpeg',
      } as any);

      const { data } = await UploadAPI.uploadImage(formData, 'proof');
      const photoUrl = data.data?.url ?? (data as any).url;

      if (!photoUrl) throw new Error('Could not process uploaded image response.');

      await JobsAPI.addWorkProof(job.id, stage, [photoUrl]);
      await load();
      Alert.alert('Success', `${stage === 'before' ? 'Before' : 'After'} photo uploaded successfully.`);
    } catch (e: any) {
      console.log('uploadProof error:', e);
      Alert.alert('Upload Failed', e?.response?.data?.message || e?.message || 'Failed to upload photo. Please try again.');
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
            <Ionicons name="warning-outline" size={18} color={colors.danger} />
            <Text style={styles.overdueBannerText}>
              This job's scheduled time has passed. Please start it now, or contact support if delayed.
            </Text>
          </View>
        ) : null}

        <Card>
          <Text style={styles.sectionTitle}>Service Details</Text>
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
          <Text style={styles.sectionTitle}>{jobIsOver ? 'Location' : 'Customer & Location'}</Text>

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
              This job is closed, customer contact details are hidden for privacy.
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
              Tap the camera icons to upload "Before" and "After" photos of the site. Photos protect your payout if disputes arise.
            </Text>

            {/* Before Photos */}
            <View style={{ marginTop: spacing.md }}>
              <View style={styles.proofHeader}>
                <Text style={styles.proofStageTitle}>Before Photos</Text>
                <Text style={styles.proofStageCount}>{(job.proofBeforePhotos ?? []).length} uploaded</Text>
              </View>
              <View style={styles.photoRow}>
                {(job.proofBeforePhotos ?? []).map((url, i) => (
                  <Pressable
                    key={i}
                    onPress={() => setPreviewImage({ url, title: 'Before Work Photo' })}
                  >
                    <Image source={{ uri: url }} style={styles.photoThumb} />
                  </Pressable>
                ))}
                <Pressable
                  style={[styles.addPhotoBtn, uploadingStage === 'before' && styles.addPhotoBtnActive]}
                  disabled={uploadingStage === 'before'}
                  onPress={() => setPickerModalStage('before')}
                >
                  {uploadingStage === 'before' ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="camera-outline" size={22} color={colors.primary} />
                      <Text style={styles.addPhotoText}>Before</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>

            {/* After Photos */}
            <View style={{ marginTop: spacing.md }}>
              <View style={styles.proofHeader}>
                <Text style={styles.proofStageTitle}>After Photos</Text>
                <Text style={styles.proofStageCount}>{(job.proofAfterPhotos ?? []).length} uploaded</Text>
              </View>
              <View style={styles.photoRow}>
                {(job.proofAfterPhotos ?? []).map((url, i) => (
                  <Pressable
                    key={i}
                    onPress={() => setPreviewImage({ url, title: 'After Work Photo' })}
                  >
                    <Image source={{ uri: url }} style={styles.photoThumb} />
                  </Pressable>
                ))}
                <Pressable
                  style={[styles.addPhotoBtn, uploadingStage === 'after' && styles.addPhotoBtnActive]}
                  disabled={uploadingStage === 'after'}
                  onPress={() => setPickerModalStage('after')}
                >
                  {uploadingStage === 'after' ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="camera-outline" size={22} color={colors.primary} />
                      <Text style={styles.addPhotoText}>After</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </Card>
        ) : null}

        {job.payment ? (
          <Card style={{ marginTop: spacing.md }}>
            <Text style={styles.sectionTitle}>Payment Info</Text>
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
                  ? 'Make sure work is completed to customer satisfaction.'
                  : "You haven't added an \"after\" photo yet. Add an after photo to protect your payout if disputed later. Complete anyway?",
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Complete',
                    onPress: () =>
                      runAction(() => JobsAPI.complete(job.id), 'Job marked complete. Great job!'),
                  },
                ],
              );
            }}
          />
        ) : null}
      </View>

      {/* Image Upload Source Selector Modal */}
      <ImagePickerModal
        visible={!!pickerModalStage}
        onClose={() => setPickerModalStage(null)}
        title={`Upload ${pickerModalStage === 'before' ? 'Before' : 'After'} Photo`}
        subtitle={`Select camera or gallery to take ${pickerModalStage === 'before' ? 'a before' : 'an after'} work proof photo`}
        onImagePicked={(uri) => {
          if (pickerModalStage) {
            handleImagePicked(uri, pickerModalStage);
          }
        }}
      />

      {/* Fullscreen Photo Preview Modal */}
      <ImageViewerModal
        visible={!!previewImage}
        imageUrl={previewImage?.url ?? null}
        title={previewImage?.title ?? 'Work Proof Photo'}
        onClose={() => setPreviewImage(null)}
      />

      {/* Start Job OTP Modal with Modern UI */}
      <Modal
        visible={startModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStartModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="key" size={28} color={colors.primary} />
            </View>
            <Text style={styles.modalTitle}>Customer Verification Code</Text>
            <Text style={styles.modalSubtitle}>
              Ask the customer for the 4-digit start OTP shown on their screen to begin work.
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

            {startError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
                <Text style={styles.modalErrorText}>{startError}</Text>
              </View>
            ) : null}

            <Button
              title="Verify & Start Work"
              loading={acting}
              onPress={submitStartOtp}
              style={{ marginTop: spacing.lg, width: '100%' }}
            />

            <Pressable
              style={styles.modalCancelBtn}
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
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    alignItems: 'center',
    ...shadow.raised,
  },
  modalIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary, marginBottom: spacing.xs, textAlign: 'center' },
  modalSubtitle: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 20 },
  modalOtpInput: {
    width: 180,
    height: 60,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.background,
    textAlign: 'center',
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.extrabold,
    color: colors.textPrimary,
    letterSpacing: 10,
  },
  modalOtpInputError: { borderColor: colors.danger },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    backgroundColor: colors.dangerLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  modalErrorText: { color: colors.danger, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  modalCancelBtn: { marginTop: spacing.md, paddingVertical: spacing.xs },
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
  proofHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  proofStageTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  proofStageCount: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xs },
  photoThumb: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  addPhotoBtn: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  addPhotoBtnActive: {
    opacity: 0.6,
  },
  addPhotoText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    marginTop: 2,
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
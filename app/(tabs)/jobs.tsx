import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors, fontSize, fontWeight, spacing, radius } from '../../src/theme';
import { Card, StatusPill, statusTone, statusLabel, EmptyState } from '../../src/components/ui';
import Button from '../../src/components/Button';
import { JobsAPI, Job, JobStatus } from '../../src/api/endpoints';

type TabKey = 'requests' | 'upcoming' | 'history';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'requests', label: 'New' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'history', label: 'History' },
];

export default function Jobs() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('requests');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async (which: TabKey) => {
    setLoading(true);
    try {
      if (which === 'requests') {
        const { data } = await JobsAPI.pendingRequests();
        setJobs(data.data ?? []);
      } else if (which === 'upcoming') {
        const { data } = await JobsAPI.upcoming();
        setJobs(data.data ?? []);
      } else {
        const results = await Promise.all(
          (['COMPLETED', 'CANCELLED', 'REJECTED'] as JobStatus[]).map((s) => JobsAPI.myJobs(s)),
        );
        const merged = results.flatMap((r) => r.data.data ?? []);
        merged.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        setJobs(merged);
      }
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(tab);
    }, [tab, load]),
  );

  const accept = async (id: string) => {
    setActingId(id);
    try {
      await JobsAPI.accept(id);
      await load(tab);
      router.push({ pathname: '/job/[id]', params: { id } });
    } catch (e: any) {
      Alert.alert('Could not accept', e?.response?.data?.message || 'This job may no longer be available.');
      await load(tab);
    } finally {
      setActingId(null);
    }
  };

  const reject = (id: string) => {
    Alert.alert('Decline job?', 'This request will be offered to another worker.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          setActingId(id);
          try {
            await JobsAPI.reject(id);
            await load(tab);
          } catch (e: any) {
            Alert.alert('Could not decline', e?.response?.data?.message || 'Please try again.');
          } finally {
            setActingId(null);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.heading}>Jobs</Text>
      </View>

      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}>
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(j) => j.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              icon="briefcase-outline"
              title={tab === 'requests' ? 'No new requests' : tab === 'upcoming' ? 'No upcoming jobs' : 'No job history yet'}
              subtitle={tab === 'requests' ? 'Go online from the Home tab to start receiving job requests.' : undefined}
            />
          }
          renderItem={({ item }) => (
            <Card
              style={styles.jobCard}
              onPress={tab !== 'requests' ? () => router.push({ pathname: '/job/[id]', params: { id: item.id } }) : undefined}
            >
              <View style={styles.jobTop}>
                <Text style={styles.jobService}>
                  {item.items?.map((i) => i.service?.name).filter(Boolean).join(', ') || 'Service request'}
                </Text>
                <StatusPill label={statusLabel(item.status)} tone={statusTone(item.status)} />
              </View>
              <Text style={styles.jobMeta}>
                {new Date(item.scheduledDate).toLocaleDateString()} · {item.scheduledTime}
              </Text>
              {item.address?.city ? <Text style={styles.jobMeta}>{item.address.city}</Text> : null}
              <Text style={styles.jobAmount}>₹{(item.finalAmount ?? item.total ?? 0).toFixed(0)}</Text>

              {tab === 'requests' ? (
                <View style={styles.actionRow}>
                  <Button
                    title="Decline"
                    variant="outline"
                    size="sm"
                    onPress={() => reject(item.id)}
                    disabled={actingId === item.id}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Accept"
                    size="sm"
                    onPress={() => accept(item.id)}
                    loading={actingId === item.id}
                    style={{ flex: 1 }}
                  />
                </View>
              ) : null}
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.xxl, paddingTop: spacing.md },
  heading: { fontSize: fontSize.xxl, fontWeight: fontWeight.extrabold, color: colors.textPrimary },
  tabRow: { flexDirection: 'row', paddingHorizontal: spacing.xxl, marginTop: spacing.lg, gap: spacing.sm },
  tabBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.pill, alignItems: 'center', backgroundColor: colors.surfaceMuted },
  tabBtnActive: { backgroundColor: colors.primary },
  tabText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary },
  tabTextActive: { color: colors.white },
  list: { padding: spacing.xxl, gap: spacing.md, flexGrow: 1 },
  jobCard: { gap: 4 },
  jobTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  jobService: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  jobMeta: { fontSize: fontSize.xs, color: colors.textMuted },
  jobAmount: { fontSize: fontSize.md, fontWeight: fontWeight.extrabold, color: colors.primary, marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});

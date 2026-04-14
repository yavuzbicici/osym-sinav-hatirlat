import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { OsymHeroHeaderBand } from '@/components/osym-hero-header-block';
import { OsymNotificationRemindersInfo } from '@/components/osym-notification-reminders-info';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useStrongCardBorders } from '@/hooks/use-accessibility-borders';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  requestNotificationPermission,
  schedulePreferenceNotificationsDaily_13_25,
} from '@/lib/notifications/osym-preference-notifications';
import { getSelectedExamIds, setExamNotificationSelected } from '@/lib/notifications/selected-exams';
import { formatPreferenceWindowHint } from '@/lib/osym/preference-window';
import type { OsymTakvimItem } from '@/lib/osym/takvim';
import { fetchOsymTakvim } from '@/lib/osym/takvim';

function normalizeForSearch(input: string) {
  // Make search resilient across platforms/locales (especially Turkish İ/ı behavior).
  // - lowercases
  // - normalizes diacritics
  // - maps Turkish dotted/dotless i to plain i
  return input
    .replaceAll('İ', 'I')
    .replaceAll('ı', 'i')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

function formatDateMaybe(item: OsymTakvimItem) {
  if (!item.date) return item.sinavTarihi;
  try {
    // Turkish-style output, keeps time if present in original.
    const hasTime = /\d{2}:\d{2}/.test(item.sinavTarihi);
    const datePart = item.date.toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    if (!hasTime) return datePart;
    const timePart = item.date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    return `${datePart} ${timePart}`;
  } catch {
    return item.sinavTarihi;
  }
}

type TakvimSection = {
  title: string;
  data: OsymTakvimItem[];
};

function monthKeyOf(item: OsymTakvimItem) {
  if (item.date) return `${item.date.getFullYear()}-${String(item.date.getMonth() + 1).padStart(2, '0')}`;
  // Fallback: best-effort key using date-like text.
  const m = item.sinavTarihi.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (m) return `${m[3]}-${m[2]}`;
  return 'unknown';
}

function monthTitleFromKey(key: string) {
  const m = key.match(/^(\d{4})-(\d{2})$/);
  if (!m) return 'Tarihi Belirsiz';
  const yyyy = Number(m[1]);
  const mm = Number(m[2]);
  const d = new Date(yyyy, mm - 1, 1);
  return d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
}

export default function TakvimScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = (colorScheme ?? 'light') === 'dark';
  const strongBorders = useStrongCardBorders();

  const [query, setQuery] = useState('');
  const [items, setItems] = useState<OsymTakvimItem[]>([]);
  const [sourceUrl, setSourceUrl] = useState<string>('https://www.osym.gov.tr/TR,8797/takvim.html');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifyIds, setNotifyIds] = useState<Set<string>>(() => new Set());

  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<SectionList<OsymTakvimItem>>(null);

  const filtered = useMemo(() => {
    const q = normalizeForSearch(query.trim());
    if (!q) return items;
    return items.filter((x) => {
      const hay = normalizeForSearch(`${x.sinav} ${x.sinavTarihi}`);
      return hay.includes(q);
    });
  }, [items, query]);

  const sections = useMemo<TakvimSection[]>(() => {
    const buckets = new Map<string, OsymTakvimItem[]>();
    for (const item of filtered) {
      const key = monthKeyOf(item);
      const arr = buckets.get(key);
      if (arr) arr.push(item);
      else buckets.set(key, [item]);
    }

    const sortedKeys = Array.from(buckets.keys()).sort((a, b) => {
      if (a === 'unknown') return 1;
      if (b === 'unknown') return -1;
      return a.localeCompare(b);
    });

    return sortedKeys.map((k) => ({
      title: monthTitleFromKey(k),
      data: (buckets.get(k) ?? []).slice().sort((a, b) => {
        const ad = a.date?.getTime();
        const bd = b.date?.getTime();
        if (ad != null && bd != null) return ad - bd;
        if (ad != null) return -1;
        if (bd != null) return 1;
        return a.sinavTarihi.localeCompare(b.sinavTarihi, 'tr');
      }),
    }));
  }, [filtered]);

  const load = useCallback(async (kind: 'initial' | 'refresh') => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (kind === 'initial') setLoading(true);
    if (kind === 'refresh') setRefreshing(true);
    setError(null);

    try {
      const data = await fetchOsymTakvim(controller.signal);
      setItems(data.items);
      setSourceUrl(data.sourceUrl);
    } catch (e: any) {
      setError(e?.message ?? 'Bilinmeyen hata');
    } finally {
      if (kind === 'initial') setLoading(false);
      if (kind === 'refresh') setRefreshing(false);
    }
  }, [setItems, setSourceUrl, setError, setLoading, setRefreshing]);

  useEffect(() => {
    void load('initial');
    return () => {
      abortRef.current?.abort();
    };
  }, [load]);

  useEffect(() => {
    if (loading || error) return;
    let cancelled = false;
    (async () => {
      const ids = await getSelectedExamIds();
      if (!cancelled) setNotifyIds(new Set(ids));
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, error, items.length]);

  const reloadNotifySelection = useCallback(async () => {
    const ids = await getSelectedExamIds();
    setNotifyIds(new Set(ids));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reloadNotifySelection();
    }, [reloadNotifySelection]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') void reloadNotifySelection();
    });
    return () => sub.remove();
  }, [reloadNotifySelection]);

  const onToggleExamNotify = useCallback(async (item: OsymTakvimItem, value: boolean) => {
    setNotifyIds((prev) => {
      const next = new Set(prev);
      if (value) next.add(item.id);
      else next.delete(item.id);
      return next;
    });
    await setExamNotificationSelected(item.id, value);
    if (value && Platform.OS !== 'web') {
      await requestNotificationPermission();
    }
    try {
      await schedulePreferenceNotificationsDaily_13_25();
    } catch {
      // native scheduling may fail (limits); UI selection still saved
    }
  }, []);

  return (
    <ThemedView style={styles.container}>
      <OsymHeroHeaderBand />
      <View style={styles.header}>
        <OsymNotificationRemindersInfo />
        <ThemedText style={{ opacity: 0.8 }}>
          Görev tercihi için sınav tarihlerini hızlıca gör.
        </ThemedText>

        <View
          style={[
            styles.searchWrap,
            {
              backgroundColor: isDark ? '#16191C' : '#FFFFFF',
              borderColor: isDark ? '#2A2F35' : '#E6E8EC',
            },
          ]}>
          <View style={[styles.searchIconChip, { backgroundColor: isDark ? '#22272D' : '#F2F4F6' }]}>
            <IconSymbol name="magnifyingglass" size={18} color={colors.icon} />
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Sınav ara (YKS, ALES, YDS...)"
            placeholderTextColor={colors.icon}
            style={[styles.searchInput, { color: colors.text }]}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Sınav ara"
            accessibilityHint="Liste içinde sınav adına veya tarihe göre filtreler."
          />
          {!!query.trim() && (
            <Pressable
              onPress={() => setQuery('')}
              hitSlop={10}
              style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
              <IconSymbol name="xmark.circle.fill" size={20} color={colors.icon} />
            </Pressable>
          )}
        </View>

        <View style={styles.quickMetaRow}>
          <View style={[styles.quickMetaChip, { backgroundColor: isDark ? '#22272D' : '#FFFFFF' }]}>
            <ThemedText style={styles.quickMetaText}>
              {filtered.length} / {items.length} kayıt
            </ThemedText>
          </View>
          <View style={[styles.quickMetaChip, { backgroundColor: isDark ? '#22272D' : '#FFFFFF' }]}>
            <ThemedText style={styles.quickMetaText}>{notifyIds.size} bildirim seçili</ThemedText>
          </View>
        </View>

        <Pressable
          onPress={() => Linking.openURL(sourceUrl)}
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }, styles.sourceLink]}>
          <ThemedText type="link">Kaynak: ÖSYM Sınav Takvimi</ThemedText>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <ThemedText style={{ marginTop: 12, opacity: 0.8 }}>Takvim yükleniyor...</ThemedText>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <ThemedText type="subtitle">Yüklenemedi</ThemedText>
          <ThemedText style={{ marginTop: 8, textAlign: 'center', opacity: 0.8 }}>
            {error}
          </ThemedText>
          <Pressable
            onPress={() => load('initial')}
            style={({ pressed }) => [
              styles.retryButton,
              { backgroundColor: colors.tint, opacity: pressed ? 0.8 : 1 },
            ]}>
            <ThemedText style={{ color: '#fff', fontWeight: '700' }}>Tekrar dene</ThemedText>
          </Pressable>
        </View>
      ) : (
        <SectionList
          ref={listRef}
          sections={sections}
          keyExtractor={(x) => x.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} />}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled
          ListHeaderComponent={() => (
            <View style={styles.metaRow}>
              <ThemedText style={{ opacity: 0.8 }}>
                {filtered.length} / {items.length} kayıt
              </ThemedText>
            </View>
          )}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeaderWrap}>
              <View style={styles.sectionHeaderPill}>
                <ThemedText style={styles.sectionHeaderText}>{section.title}</ThemedText>
              </View>
            </View>
          )}
          renderItem={({ item, index, section }) => {
            const prefHint = formatPreferenceWindowHint(item.date);
            const isFirstExamRow =
              sections.length > 0 && section.title === sections[0].title && index === 0;
            return (
              <View
                accessible
                accessibilityRole="summary"
                accessibilityLabel={`${item.sinav}. Sınav tarihi: ${formatDateMaybe(item)}.${
                  prefHint ? ` ${prefHint}.` : ''
                } Bildirim ${notifyIds.has(item.id) ? 'açık' : 'kapalı'}.`}
                style={[
                  styles.card,
                  {
                    borderWidth: strongBorders ? 2 : StyleSheet.hairlineWidth,
                    borderColor: isDark ? '#2A2F35' : '#E6E8EC',
                    backgroundColor: isDark ? '#16191C' : '#FFFFFF',
                  },
                ]}>
                <View style={styles.cardTopRow}>
                  <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
                    {item.sinav}
                  </ThemedText>
                  <View style={[styles.dateChip, { backgroundColor: isDark ? '#22272D' : '#F2F4F6' }]}>
                    <ThemedText style={{ fontSize: 12, fontWeight: '700', opacity: 0.9 }}>
                      {formatDateMaybe(item)}
                    </ThemedText>
                  </View>
                </View>
                {prefHint ? (
                  <ThemedText
                    style={[styles.preferenceHint, { color: colors.text }]}
                    accessibilityRole="text">
                    {prefHint}
                    <ThemedText style={styles.preferenceHintDisclaimer}>
                      {' '}
                      (Kesin tarihler ÖSYM duyurusuna göredir.)
                    </ThemedText>
                  </ThemedText>
                ) : null}
                <View style={styles.notifyRow}>
                  <ThemedText style={[styles.notifyLabel, { color: colors.text }]}>Bildirim</ThemedText>
                  <Switch
                    testID={isFirstExamRow ? 'e2e-takvim-notify-switch' : undefined}
                    accessibilityLabel={`${item.sinav} için bildirim`}
                    accessibilityHint="Açıkken bu sınav için görev tercihi hatırlatması planlanır."
                    value={notifyIds.has(item.id)}
                    onValueChange={(v) => void onToggleExamNotify(item, v)}
                    disabled={Platform.OS === 'web'}
                    trackColor={{ false: isDark ? '#3A3F45' : '#D8DDE3', true: `${colors.tint}99` }}
                    thumbColor={notifyIds.has(item.id) ? colors.tint : isDark ? '#9BA1A6' : '#f4f3f4'}
                  />
                </View>
              </View>
            );
          }}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  searchIconChip: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    fontSize: 16,
    flex: 1,
  },
  quickMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 2,
  },
  quickMetaChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  quickMetaText: {
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.85,
  },
  sourceLink: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  retryButton: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  metaRow: {
    paddingVertical: 10,
  },
  sectionHeaderWrap: {
    paddingTop: 14,
    paddingBottom: 8,
  },
  sectionHeaderPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#F7D154',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: 0.2,
    textTransform: 'capitalize',
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  notifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.25)',
  },
  notifyLabel: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.9,
  },
  cardTitle: {
    flex: 1,
  },
  preferenceHint: {
    fontSize: 12,
    lineHeight: 17,
    opacity: 0.88,
    marginTop: 8,
  },
  preferenceHintDisclaimer: {
    opacity: 0.65,
    fontSize: 11,
  },
  dateChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});


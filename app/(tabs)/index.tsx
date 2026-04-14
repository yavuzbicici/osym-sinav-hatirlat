import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { HelloWave } from '@/components/hello-wave';
import { OsymHeroHeaderBand } from '@/components/osym-hero-header-block';
import { ExternalLink } from '@/components/external-link';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { OsymTakvimItem } from '@/lib/osym/takvim';
import { fetchOsymTakvim } from '@/lib/osym/takvim';
import { Link } from 'expo-router';

type UpcomingSection = { title: string; items: OsymTakvimItem[] };

function monthTitleFromDate(d: Date) {
  return d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
}

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = (colorScheme ?? 'light') === 'dark';

  const [upcoming, setUpcoming] = useState<OsymTakvimItem[]>([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);
  const [upcomingError, setUpcomingError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingUpcoming(true);
      setUpcomingError(null);
      try {
        const { items } = await fetchOsymTakvim();
        if (!mounted) return;

        const now = new Date();
        const end = new Date(now);
        end.setMonth(end.getMonth() + 2);

        const filtered = items
          .filter((x) => x.date && x.date >= now && x.date <= end)
          .sort((a, b) => (a.date!.getTime() - b.date!.getTime()))
          .slice(0, 8);

        setUpcoming(filtered);
      } catch (e: any) {
        if (!mounted) return;
        setUpcomingError(e?.message ?? 'Takvim alınamadı');
      } finally {
        if (!mounted) return;
        setLoadingUpcoming(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const upcomingTitle = useMemo(() => {
    return `Önümüzdeki 2 Ay İçindeki Sınavlar`;
  }, []);

  const upcomingSections = useMemo<UpcomingSection[]>(() => {
    const map = new Map<string, { dateKey: string; title: string; items: OsymTakvimItem[] }>();

    for (const it of upcoming) {
      if (!it.date) continue;
      const dateKey = `${it.date.getFullYear()}-${String(it.date.getMonth() + 1).padStart(2, '0')}`;
      const existing = map.get(dateKey);
      if (existing) existing.items.push(it);
      else map.set(dateKey, { dateKey, title: monthTitleFromDate(new Date(it.date.getFullYear(), it.date.getMonth(), 1)), items: [it] });
    }

    return Array.from(map.values())
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
      .map((x) => ({ title: x.title, items: x.items }));
  }, [upcoming]);

  return (
    <ThemedView style={styles.screen}>
      <OsymHeroHeaderBand />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator>
        <ThemedView style={styles.welcomeRow}>
          <ThemedText type="title">Hoş geldin</ThemedText>
          <HelloWave />
        </ThemedView>

        <ThemedView
          style={[
            styles.gisCard,
            { backgroundColor: isDark ? '#16191C' : '#FFFFFF', borderColor: isDark ? '#2A2F35' : '#E6E8EC' },
          ]}>
          <ThemedView style={styles.gisCardTop}>
            <ThemedText type="subtitle">Görevli İşlemleri Sistemi</ThemedText>
            <View style={[styles.gisBadge, { backgroundColor: isDark ? '#22272D' : '#F2F4F6' }]}>
              <ThemedText style={{ fontSize: 12, fontWeight: '700', opacity: 0.85 }}>GİS</ThemedText>
            </View>
          </ThemedView>
          <ThemedText style={{ opacity: 0.8, marginTop: 6 }}>
            Görev tercihinde bulunmak için aşağıdaki bağlantıyı kullan.
          </ThemedText>
          <Pressable
            onPress={() => Linking.openURL('https://gis.osym.gov.tr/')}
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }, styles.gisLinkInline]}>
            <ThemedText type="link">https://gis.osym.gov.tr/</ThemedText>
          </Pressable>
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText type="subtitle">{upcomingTitle}</ThemedText>

          {loadingUpcoming ? (
            <View style={styles.upcomingRow}>
              <ActivityIndicator />
              <ThemedText style={{ opacity: 0.8 }}>Yükleniyor...</ThemedText>
            </View>
          ) : upcomingError ? (
            <ThemedView style={styles.upcomingError}>
              <ThemedText style={{ opacity: 0.85 }}>{upcomingError}</ThemedText>
              <ExternalLink href="https://www.osym.gov.tr/TR,8797/takvim.html" style={{ paddingVertical: 6 }}>
                <ThemedText type="link">Takvimi web’den aç</ThemedText>
              </ExternalLink>
            </ThemedView>
          ) : !upcoming.length ? (
            <ThemedText style={{ opacity: 0.8 }}>Önümüzdeki 2 ay içinde sınav bulunamadı.</ThemedText>
          ) : (
            <ThemedView style={styles.upcomingList}>
              {upcomingSections.map((section) => (
                <ThemedView key={section.title} style={styles.upcomingSection}>
                  <View style={styles.sectionHeaderPill}>
                    <ThemedText style={styles.sectionHeaderText}>{section.title}</ThemedText>
                  </View>
                  {section.items.map((x) => (
                    <ThemedView key={x.id} style={styles.upcomingItem}>
                      <ThemedText type="defaultSemiBold">{x.sinav}</ThemedText>
                      <ThemedText style={{ opacity: 0.85 }}>{x.sinavTarihi}</ThemedText>
                    </ThemedView>
                  ))}
                </ThemedView>
              ))}
              <Link href="/(tabs)/takvim" asChild>
                <Pressable style={styles.moreLink}>
                  <ThemedText type="link">Takvime git</ThemedText>
                </Pressable>
              </Link>
            </ThemedView>
          )}
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 32,
    gap: 16,
    paddingBottom: 40,
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  gisCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
    marginBottom: 10,
  },
  gisCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  gisBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  gisLinkInline: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  section: {
    gap: 10,
    marginTop: 8,
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  upcomingError: {
    gap: 6,
  },
  upcomingList: {
    gap: 10,
  },
  upcomingSection: {
    gap: 10,
  },
  sectionHeaderPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#F7D154',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: 0.2,
    textTransform: 'capitalize',
  },
  upcomingItem: {
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(10,126,164,0.08)',
  },
  moreLink: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
});

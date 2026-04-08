import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
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

export default function TakvimScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [query, setQuery] = useState('');
  const [items, setItems] = useState<OsymTakvimItem[]>([]);
  const [sourceUrl, setSourceUrl] = useState<string>('https://www.osym.gov.tr/TR,8797/takvim.html');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const filtered = useMemo(() => {
    const q = normalizeForSearch(query.trim());
    if (!q) return items;
    return items.filter((x) => {
      const hay = normalizeForSearch(`${x.sinav} ${x.sinavTarihi}`);
      return hay.includes(q);
    });
  }, [items, query]);

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

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title" style={{ fontFamily: Fonts.rounded }}>
          ÖSYM Takvim
        </ThemedText>
        <ThemedText style={{ opacity: 0.8 }}>
          Görev tercihi için sınav tarihlerini hızlıca gör.
        </ThemedText>

        <View
          style={[
            styles.searchWrap,
            { borderColor: colors.icon, backgroundColor: colors.background },
          ]}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Sınav ara (ör: YKS, ALES, YDS...)"
            placeholderTextColor={colors.icon}
            style={[styles.searchInput, { color: colors.text }]}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
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
        <FlatList
          data={filtered}
          keyExtractor={(x) => x.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} />}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.metaRow}>
              <ThemedText style={{ opacity: 0.8 }}>
                {filtered.length} / {items.length} kayıt
              </ThemedText>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { borderColor: colors.icon, backgroundColor: colors.background }]}>
              <ThemedText type="defaultSemiBold">{item.sinav}</ThemedText>
              <ThemedText style={{ marginTop: 6, opacity: 0.9 }}>
                Sınav Tarihi: {formatDateMaybe(item)}
              </ThemedText>
            </View>
          )}
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
    paddingTop: 18,
    paddingBottom: 8,
    gap: 8,
  },
  searchWrap: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    fontSize: 16,
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
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
});


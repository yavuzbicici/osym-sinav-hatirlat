import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { OsymHeroHeaderBand } from '@/components/osym-hero-header-block';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { type ThemePreference, useAppTheme, useColorScheme } from '@/hooks/use-color-scheme';

export default function AyarlarScreen() {
  const { preference, setPreference } = useAppTheme();
  const scheme = useColorScheme();

  return (
    <ThemedView style={styles.screen}>
      <OsymHeroHeaderBand />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator>
        <ThemedText type="title" style={styles.title}>
          Ayarlar
        </ThemedText>
        <ThemedView style={styles.themeBlock}>
          <ThemedText type="subtitle">Görünüm</ThemedText>
          <ThemedText style={styles.themeHint}>
            Metin boyutu cihazın erişilebilirlik / yazı boyutu ayarlarından büyütülebilir.
          </ThemedText>
          <View style={styles.themeRow}>
            {THEME_OPTIONS.map(({ key, label }) => (
              <Pressable
                key={key}
                onPress={() => void setPreference(key)}
                accessibilityRole="button"
                accessibilityState={{ selected: preference === key }}
                accessibilityLabel={`Tema ${label}`}
                style={({ pressed }) => [
                  styles.themeChip,
                  {
                    borderColor: preference === key ? Colors[scheme].tint : 'rgba(128,128,128,0.35)',
                    borderWidth: preference === key ? 2 : 1,
                    opacity: pressed ? 0.88 : 1,
                  },
                ]}>
                <ThemedText style={{ fontSize: 13, fontWeight: '600' }}>{label}</ThemedText>
              </Pressable>
            ))}
          </View>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const THEME_OPTIONS: { key: ThemePreference; label: string }[] = [
  { key: 'system', label: 'Sistem' },
  { key: 'light', label: 'Açık' },
  { key: 'dark', label: 'Koyu' },
  { key: 'blue', label: 'Mavi' },
];

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    gap: 14,
    paddingBottom: 40,
  },
  title: {
    marginTop: 4,
  },
  themeBlock: {
    gap: 8,
    marginTop: 4,
  },
  themeHint: {
    opacity: 0.78,
    fontSize: 13,
    lineHeight: 18,
  },
  themeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  themeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
});

import { StyleSheet, View } from 'react-native';

import { OsymBrandHeader } from '@/components/osym-brand-header';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** Kurumsal üst şerit renkleri (Takvim / Home / Bilgilendirme ortak) */
export const OSYM_HERO_COLORS = {
  light: '#A1CEDC',
  dark: '#1D3D47',
} as const;

const INSTITUTION = 'T.C. Ölçme, Seçme ve Yerleştirme Merkezi';

/**
 * Teal şerit + logo kartı + kurum satırı — tüm sekmelerde aynı bileşen (ÖSYM Takvimi referansı).
 */
export function OsymHeroHeaderBand() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';

  return (
    <View
      style={[
        styles.bandRoot,
        { backgroundColor: isDark ? OSYM_HERO_COLORS.dark : OSYM_HERO_COLORS.light },
      ]}>
      <OsymBrandHeader variant="hero" />
      <View style={styles.bandInstitution}>
        <ThemedText style={styles.institutionText}>{INSTITUTION}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bandRoot: {
    width: '100%',
    paddingBottom: 6,
  },
  bandInstitution: {
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 2,
    paddingBottom: 12,
  },
  institutionText: {
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 18,
    paddingHorizontal: 12,
  },
});

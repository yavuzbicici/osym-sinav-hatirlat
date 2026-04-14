import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';

type Props = {
  /**
   * `hero`: Parallax üstünde hafif cam/beyaz kart içinde logo (orijinal kurumsal görünüme yakın).
   * `default`: Düz sekme arka planında ince alt çizgili şerit.
   */
  variant?: 'default' | 'hero';
};

export function OsymBrandHeader({ variant = 'default' }: Props) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const isHero = variant === 'hero';

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top },
        !isHero && {
          backgroundColor: isDark ? '#151718' : '#FFFFFF',
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
        },
        isHero && { paddingBottom: 6 },
      ]}>
      <View
        style={[
          styles.inner,
          isHero && styles.innerHero,
          isHero && {
            backgroundColor: isDark ? 'rgba(255,255,255,0.11)' : 'rgba(255,255,255,0.94)',
            marginHorizontal: 16,
            borderRadius: 18,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.65)',
            shadowColor: '#000',
            shadowOpacity: isDark ? 0.35 : 0.12,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 },
            elevation: 4,
          },
        ]}>
        <Image
          source={require('@/assets/images/osym-logo.png')}
          contentFit="contain"
          style={[styles.logo, isHero && styles.logoHero]}
          accessibilityLabel="ÖSYM logosu"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  /** Logo 52 + üst/alt 12+12; tüm sekmelerde kart yüksekliği aynı kalsın */
  innerHero: {
    paddingVertical: 12,
    minHeight: 80,
    justifyContent: 'center',
  },
  logo: {
    width: 188,
    height: 44,
    maxWidth: '92%',
  },
  /** Takvim / Home / Bilgilendirme aynı kart boyutu; %92 üst stili hero’da küçültmesin diye sabitlendi */
  logoHero: {
    width: 220,
    height: 52,
    maxWidth: 220,
    alignSelf: 'center',
  },
});

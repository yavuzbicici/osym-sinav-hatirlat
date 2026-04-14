import { Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function OsymNotificationRemindersInfo() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const isDark = colorScheme === 'dark';

  return (
    <View style={[styles.infoCard, { backgroundColor: isDark ? '#1C1F22' : '#F2F4F6' }]}>
      <View style={styles.infoCardIcon}>
        <IconSymbol name="calendar" size={18} color={colors.icon} />
      </View>
      <View style={styles.infoCardBody}>
        <ThemedText style={styles.infoCardTitle}>Bildirim hatırlatmaları</ThemedText>
        <ThemedText style={styles.infoCardText}>
          İstediğiniz sınavlarda <ThemedText style={{ fontWeight: '800' }}>Bildirim</ThemedText>’i açın. Seçtikleriniz için
          tercih hatırlatması <ThemedText style={{ fontWeight: '800' }}>09:00</ThemedText>’da planlanır.
          {Platform.OS === 'web' ? ' Web’de zamanlama yok; seçimler kaydedilir.' : ''}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  infoCard: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  infoCardIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,126,164,0.10)',
  },
  infoCardBody: {
    flex: 1,
    gap: 4,
  },
  infoCardTitle: {
    fontWeight: '800',
    opacity: 0.92,
  },
  infoCardText: {
    opacity: 0.78,
    fontSize: 13,
    lineHeight: 18,
  },
});

import { ScrollView, StyleSheet, View } from 'react-native';

import { OsymHeroHeaderBand } from '@/components/osym-hero-header-block';
import { Collapsible } from '@/components/ui/collapsible';
import { ExternalLink } from '@/components/external-link';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts } from '@/constants/theme';

export default function TabTwoScreen() {
  return (
    <ThemedView style={styles.screen}>
      <OsymHeroHeaderBand />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator>
        <ThemedView style={styles.titleContainer}>
          <ThemedText
            type="title"
            style={{
              fontFamily: Fonts.rounded,
            }}>
            Bilgilendirme
          </ThemedText>
        </ThemedView>
        <ThemedText style={{ opacity: 0.8 }}>
          Sınav görevlendirmeleri ve tercih süreçleri hakkında kısa bilgilendirmeler.
        </ThemedText>

        <Collapsible title="Sınavlarda görev alabilmek için tercihlerimi ne zaman yapabilirim?">
          <ThemedText style={{ opacity: 0.9 }}>
            ÖSYM görevlilerden tercih toplama işlemlerini aday atama sürecinden sonra yapmaktadır.{' '}
            <ExternalLink href="https://www.osym.gov.tr/">
              <ThemedText type="link">www.osym.gov.tr</ThemedText>
            </ExternalLink>{' '}
            adresinde yer alan Sınav Takvimindeki sınav tarihlerinden 13 ile 25 gün önce görevlilerden
            tercih toplamaktadır. Tercih yapacak görevliler bu tarihleri dikkate alarak{' '}
            <ExternalLink href="https://gis.osym.gov.tr/">
              <ThemedText type="link">https://gis.osym.gov.tr</ThemedText>
            </ExternalLink>{' '}
            internet adresinden görev tercihinde bulunabilirler.
          </ThemedText>
        </Collapsible>

        <Collapsible title="Görev ücretim hesabıma neden yatmadı?">
          <ThemedText style={{ opacity: 0.9 }}>
            Görev ücreti aşağıdaki nedenlerden dolayı IBAN hesaplarına yatırılamamaktadır.
          </ThemedText>
          <ThemedView style={{ gap: 6, marginTop: 10 }}>
            <ThemedText style={{ opacity: 0.9 }}>- GİS sisteminde kayıtlı olan IBAN numaranızın hatalı olması</ThemedText>
            <ThemedText style={{ opacity: 0.9 }}>
              - Sisteme kayıtlı olan kişisel bilgileriniz ile IBAN numarasının bağlı bulunduğu bankadaki kişisel bilgilerinizin uyuşmaması
            </ThemedText>
            <ThemedText style={{ opacity: 0.9 }}>
              - Binalarda yapılan görev değişikliğinin sisteme yansıtılmamasından kaynaklanan eksikliklerden dolayı
            </ThemedText>
            <ThemedText style={{ opacity: 0.9 }}>
              - Sınav değerlendirme raporlarının doldurulmamasından dolayı ödeme yapılamamaktadır.
            </ThemedText>
          </ThemedView>
        </Collapsible>

        <Collapsible title="Diğer Sıkça Sorulan Sorular">
          <ThemedText style={{ opacity: 0.9 }}>
            Kaynak:{' '}
            <ExternalLink href="https://gis.osym.gov.tr/">
              <ThemedText type="link">https://gis.osym.gov.tr</ThemedText>
            </ExternalLink>{' '}
            adresinden <ThemedText style={{ fontWeight: '800' }}>Sıkça Sorulan Sorular</ThemedText> bölümünden ulaşabilirsiniz.
          </ThemedText>
        </Collapsible>

        <Collapsible title="ÖSYM e-İşlemler">
          <ThemedView style={{ gap: 10 }}>
            <View>
              <ThemedText style={{ fontWeight: '800' }}>Aday İşlemleri Sistemi</ThemedText>
              <ExternalLink href="https://ais.osym.gov.tr/">
                <ThemedText type="link">https://ais.osym.gov.tr</ThemedText>
              </ExternalLink>
            </View>

            <View>
              <ThemedText style={{ fontWeight: '800' }}>Görevli İşlemleri Sistemi</ThemedText>
              <ExternalLink href="https://gis.osym.gov.tr/">
                <ThemedText type="link">https://gis.osym.gov.tr</ThemedText>
              </ExternalLink>
            </View>

            <View>
              <ThemedText style={{ fontWeight: '800' }}>Sonuç Açıklama Sistemi</ThemedText>
              <ExternalLink href="https://sonuc.osym.gov.tr/">
                <ThemedText type="link">https://sonuc.osym.gov.tr</ThemedText>
              </ExternalLink>
            </View>

            <View>
              <ThemedText style={{ fontWeight: '800' }}>Ödeme İşlemleri Sistemi</ThemedText>
              <ExternalLink href="https://sanalpos.osym.gov.tr/">
                <ThemedText type="link">https://sanalpos.osym.gov.tr</ThemedText>
              </ExternalLink>
            </View>
          </ThemedView>
        </Collapsible>
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
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
  },
});

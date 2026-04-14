/**
 * ÖSYM görev tercihi toplama penceresi — kurumsal örnek aralık: sınavdan 13–25 gün önce (tahmini).
 * Kesin tarihler için her zaman resmi ÖSYM duyurusu esas alınmalıdır.
 */
export const PREFERENCE_DAYS_BEFORE_LATEST = 13;
export const PREFERENCE_DAYS_BEFORE_EARLIEST = 25;

export type PreferenceWindow = {
  start: Date;
  end: Date;
};

/** Sınav tarihine göre tahmini tercih başlangıç/bitiş (her iki uç dahil, yerel gün). */
export function getPreferenceWindow(examDate: Date): PreferenceWindow {
  const start = new Date(examDate);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - PREFERENCE_DAYS_BEFORE_EARLIEST);

  const end = new Date(examDate);
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() - PREFERENCE_DAYS_BEFORE_LATEST);

  return { start, end };
}

function formatTrDate(d: Date) {
  return d.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Kısa açıklama metni; `examDate` yoksa null. */
export function formatPreferenceWindowHint(examDate: Date | undefined): string | null {
  if (!examDate) return null;
  const { start, end } = getPreferenceWindow(examDate);
  return `Tahmini görev tercihi: ${formatTrDate(start)} – ${formatTrDate(end)}`;
}

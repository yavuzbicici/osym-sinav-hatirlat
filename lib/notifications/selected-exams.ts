import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_SELECTED_IDS = 'notifications:selectedExamIds';
const STORAGE_DISABLED_PREFIX = 'notifications:disabledExam:';

export async function getSelectedExamIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_SELECTED_IDS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/** Açık: bildirim planlanır. Kapalı: bu sınav için plan yok. */
export async function setExamNotificationSelected(examId: string, selected: boolean): Promise<void> {
  const ids = new Set(await getSelectedExamIds());
  if (selected) {
    ids.add(examId);
    await AsyncStorage.removeItem(`${STORAGE_DISABLED_PREFIX}${examId}`);
  } else {
    ids.delete(examId);
  }
  await AsyncStorage.setItem(STORAGE_SELECTED_IDS, JSON.stringify([...ids]));
}

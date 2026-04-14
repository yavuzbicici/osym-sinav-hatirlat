import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';

import { fetchOsymTakvim } from '@/lib/osym/takvim';
import { getSelectedExamIds, setExamNotificationSelected } from '@/lib/notifications/selected-exams';

const CATEGORY_ID = 'osym_preference_reminder';
const ACTION_DISABLE_EXAM = 'DISABLE_EXAM';

const STORAGE_SCHEDULED_PREFIX = 'notifications:scheduledIds:';
const STORAGE_SCHEDULE_KEY_PREFIX = 'notifications:scheduleKey:';

// Dev/test helpers (temporary). Set to false when done.
/** Legacy single dev notification (migration). */
const STORAGE_DEV_FAST_ID = 'notifications:devFast:id';
const STORAGE_DEV_FAST_EXAM = 'notifications:devFast:examId';
/** Current: one repeating dev notification per selected exam (JSON array). */
const STORAGE_DEV_FAST_IDS = 'notifications:devFast:ids';
// IMPORTANT: Keep this off by default. Repeating time-interval notifications keep firing even when
// the dev server / app is closed (OS schedules them). Enable only when explicitly testing.
const DEV_FAST_TEST_ENABLED = false;
const DEV_FAST_INTERVAL_SECONDS = 120; // every 2 minutes
const MAX_DEV_FAST_SELECTED_EXAMS = 6; // stay under iOS ~64 scheduled limit with production slots

const MAX_SCHEDULED_NOTIFICATIONS_BUDGET = 56; // keep under iOS ~64 limit
const SCHEDULING_HORIZON_DAYS = 120; // don't schedule very far exams

// Default: 09:00 (real reminders)
const REMINDER_HOUR = 9;
const REMINDER_MINUTE = 0;

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function atReminderTimeLocal(d: Date) {
  const x = new Date(d);
  x.setHours(REMINDER_HOUR, REMINDER_MINUTE, 0, 0);
  return x;
}

function isPast(d: Date) {
  return d.getTime() <= Date.now();
}

function daysBetween(from: Date, to: Date) {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function getScheduledIdsKey(examId: string) {
  return `${STORAGE_SCHEDULED_PREFIX}${examId}`;
}
function getScheduleKeyKey(examId: string) {
  return `${STORAGE_SCHEDULE_KEY_PREFIX}${examId}`;
}

async function clearScheduledNotificationsForExam(examId: string) {
  const scheduledIdsRaw = await AsyncStorage.getItem(getScheduledIdsKey(examId));
  const scheduledIds: string[] = scheduledIdsRaw ? JSON.parse(scheduledIdsRaw) : [];
  await Promise.allSettled(
    scheduledIds.map((id) => Notifications.cancelScheduledNotificationAsync(id)),
  );
  await AsyncStorage.removeItem(getScheduledIdsKey(examId));
  await AsyncStorage.removeItem(getScheduleKeyKey(examId));

  // Also cancel any OS-scheduled notifications for this exam not listed in AsyncStorage (recovery).
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    const toCancel = all.filter((n) => {
      const d = n.content.data;
      if (d == null || typeof d !== 'object') return false;
      const id = (d as Record<string, unknown>).examId;
      return id != null && String(id) === examId;
    });
    await Promise.allSettled(toCancel.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  } catch {
    // ignore
  }
}

type DevFastEntry = { id: string; examId: string };

async function cancelAllDevFastTestNotifications() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_DEV_FAST_IDS);
    const list: DevFastEntry[] = raw ? JSON.parse(raw) : [];
    await Promise.allSettled(list.map((x) => Notifications.cancelScheduledNotificationAsync(x.id)));
  } catch {
    // ignore
  }
  await AsyncStorage.removeItem(STORAGE_DEV_FAST_IDS);
  const legId = await AsyncStorage.getItem(STORAGE_DEV_FAST_ID);
  if (legId) await Notifications.cancelScheduledNotificationAsync(legId).catch(() => {});
  await AsyncStorage.removeItem(STORAGE_DEV_FAST_ID);
  await AsyncStorage.removeItem(STORAGE_DEV_FAST_EXAM);
}

async function removeDevFastNotificationsForExam(examId: string) {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_DEV_FAST_IDS);
    let list: DevFastEntry[] = raw ? JSON.parse(raw) : [];
    const toCancel = list.filter((x) => x.examId === examId);
    list = list.filter((x) => x.examId !== examId);
    await Promise.allSettled(toCancel.map((x) => Notifications.cancelScheduledNotificationAsync(x.id)));
    if (list.length) await AsyncStorage.setItem(STORAGE_DEV_FAST_IDS, JSON.stringify(list));
    else await AsyncStorage.removeItem(STORAGE_DEV_FAST_IDS);
  } catch {
    // ignore
  }
  const devFastExam = await AsyncStorage.getItem(STORAGE_DEV_FAST_EXAM);
  if (devFastExam === examId) {
    const devFastId = await AsyncStorage.getItem(STORAGE_DEV_FAST_ID);
    if (devFastId) await Notifications.cancelScheduledNotificationAsync(devFastId).catch(() => {});
    await AsyncStorage.removeItem(STORAGE_DEV_FAST_ID);
    await AsyncStorage.removeItem(STORAGE_DEV_FAST_EXAM);
  }
}

function examIdFromNotificationData(data: unknown): string {
  if (data == null || typeof data !== 'object') return '';
  const v = (data as Record<string, unknown>).examId;
  if (v == null) return '';
  return String(v);
}

/** Handle cold start: interaction is in getLastNotificationResponse, not always delivered to the listener. */
export async function flushPendingNotificationResponse(): Promise<void> {
  try {
    const last = await Notifications.getLastNotificationResponseAsync();
    if (!last) return;
    await processNotificationResponseActions(last);
    await Notifications.clearLastNotificationResponseAsync();
  } catch {
    // ignore
  }
}

export async function processNotificationResponseActions(
  response: Notifications.NotificationResponse,
): Promise<void> {
  const actionId = response.actionIdentifier;
  const examId = examIdFromNotificationData(response.notification.request.content.data);

  if (actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
    await Linking.openURL(Linking.createURL('/(tabs)/takvim'));
    return;
  }

  if (actionId === ACTION_DISABLE_EXAM) {
    if (examId) {
      await disableExamNotifications(examId);
      // Extra safety: re-run scheduling to ensure any repeating/dev schedules are fully cleaned up
      // and other selected exams stay scheduled.
      try {
        await schedulePreferenceNotificationsDaily_13_25();
      } catch {
        // ignore
      }
    }
    return;
  }
}

export async function ensureNotificationCategory() {
  await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
    {
      identifier: ACTION_DISABLE_EXAM,
      buttonTitle: 'Bu sınav için bildirimi kapat',
      options: { opensAppToForeground: true, isDestructive: true },
    },
  ]);
}

export async function requestNotificationPermission() {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return { granted: true };
  const req = await Notifications.requestPermissionsAsync();
  return { granted: !!req.granted };
}

export async function disableExamNotifications(examId: string) {
  await setExamNotificationSelected(examId, false);
  await removeDevFastNotificationsForExam(examId);
  await clearScheduledNotificationsForExam(examId);
}

async function scheduleDailyRemindersForExam(
  examId: string,
  examName: string,
  examDate: Date,
  budget: { remaining: number },
) {
  const hint = 'Seçenekler için bildirime basılı tut.';
  // Between 25 and 13 days before exam date (inclusive), every day at reminder time.
  const start = atReminderTimeLocal(addDays(examDate, -25));
  const end = atReminderTimeLocal(addDays(examDate, -13));

  const scheduledIds: string[] = [];

  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    if (budget.remaining <= 0) break;
    const fireDate = atReminderTimeLocal(d);
    if (isPast(fireDate)) continue;

    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Görev tercihi hatırlatma',
          body: `${examName} için tercih yapabilirsiniz. ${hint}`,
          categoryIdentifier: CATEGORY_ID,
          data: { examId },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireDate,
        },
      });
      scheduledIds.push(id);
      budget.remaining -= 1;
    } catch {
      // ignore scheduling failures (e.g., OS limit)
      break;
    }
  }

  // Also schedule single reminders 10 and 3 days before at 09:00.
  for (const daysBefore of [10, 3]) {
    if (budget.remaining <= 0) break;
    const fireDate = atReminderTimeLocal(addDays(examDate, -daysBefore));
    if (isPast(fireDate)) continue;
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Görev tercihi hatırlatma',
          body: `${examName} için tercih yapabilirsiniz. ${hint}`,
          categoryIdentifier: CATEGORY_ID,
          data: { examId },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireDate,
        },
      });
      scheduledIds.push(id);
      budget.remaining -= 1;
    } catch {
      break;
    }
  }

  await AsyncStorage.setItem(getScheduledIdsKey(examId), JSON.stringify(scheduledIds));
}

export async function schedulePreferenceNotificationsDaily_13_25() {
  // Cleanup: if dev-fast was enabled previously, remove any leftover time-interval schedules.
  // This prevents repeating notifications from continuing after the user turned off a specific exam
  // and/or closed the Expo dev server.
  if (!DEV_FAST_TEST_ENABLED) {
    try {
      const all = await Notifications.getAllScheduledNotificationsAsync();
      const toCancel = all.filter((n) => {
        const cat = n.content.categoryIdentifier;
        const trigger: any = n.trigger as any;
        const isTimeInterval = trigger && trigger.type === Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL;
        return cat === CATEGORY_ID && isTimeInterval;
      });
      await Promise.allSettled(toCancel.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
    } catch {
      // ignore
    }
  }

  // If we already have too many scheduled notifications, clear them once.
  try {
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    if (existing.length > MAX_SCHEDULED_NOTIFICATIONS_BUDGET) {
      await Promise.allSettled(
        existing.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
      );
    }
  } catch {
    // ignore
  }

  const { items } = await fetchOsymTakvim();
  const selectedIds = new Set(await getSelectedExamIds());

  for (const it of items) {
    if (!selectedIds.has(it.id)) {
      await clearScheduledNotificationsForExam(it.id);
    }
  }

  const now = new Date();

  // Prefer nearer exams first.
  const candidates = items
    .filter((it) => it.date && !isPast(it.date))
    .sort((a, b) => (a.date!.getTime() - b.date!.getTime()));

  let devScheduledSlotCount = 0;
  if (DEV_FAST_TEST_ENABLED && candidates.length) {
    // If you re-enable dev fast testing, keep the existing implementation; left intentionally disabled by default.
    await cancelAllDevFastTestNotifications();
    devScheduledSlotCount = 0;
  } else {
    // Make sure legacy dev-fast storage is cleared so it doesn't interfere.
    await cancelAllDevFastTestNotifications();
  }

  const budget = {
    remaining: Math.max(6, MAX_SCHEDULED_NOTIFICATIONS_BUDGET - devScheduledSlotCount - 2),
  };

  for (const it of candidates) {
    if (budget.remaining <= 0) break;
    if (!it.date) continue;
    if (isPast(it.date)) continue;
    if (daysBetween(now, it.date) > SCHEDULING_HORIZON_DAYS) continue;

    if (!selectedIds.has(it.id)) continue;

    // Idempotency: only schedule if scheduleKey changed (e.g., date updated).
    const scheduleKey = `${it.id}__${it.sinavTarihi}__${REMINDER_HOUR}:${String(REMINDER_MINUTE).padStart(2, '0')}`;
    const prevKey = await AsyncStorage.getItem(getScheduleKeyKey(it.id));
    if (prevKey === scheduleKey) {
      // If OS/Expo Go cleared scheduled notifications but AsyncStorage still has the key,
      // we must reschedule. Otherwise we can end up with zero scheduled notifications.
      const scheduledIdsRaw = await AsyncStorage.getItem(getScheduledIdsKey(it.id));
      const scheduledIds: string[] = scheduledIdsRaw ? JSON.parse(scheduledIdsRaw) : [];
      if (scheduledIds.length > 0) continue;
      await AsyncStorage.removeItem(getScheduleKeyKey(it.id));
    }

    // Cancel previously scheduled notifications for this exam (if any).
    const scheduledIdsRaw = await AsyncStorage.getItem(getScheduledIdsKey(it.id));
    const scheduledIds: string[] = scheduledIdsRaw ? JSON.parse(scheduledIdsRaw) : [];
    await Promise.allSettled(
      scheduledIds.map((id) => Notifications.cancelScheduledNotificationAsync(id)),
    );
    await AsyncStorage.removeItem(getScheduledIdsKey(it.id));

    await scheduleDailyRemindersForExam(it.id, it.sinav, it.date, budget);
    await AsyncStorage.setItem(getScheduleKeyKey(it.id), scheduleKey);
  }

}

export function attachNotificationResponseListener() {
  const sub = Notifications.addNotificationResponseReceivedListener(async (response) => {
    await processNotificationResponseActions(response);
  });

  return () => sub.remove();
}


import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import { AppState, Platform } from 'react-native';

import {
  ANDROID_NATIVE_NOTIFICATIONS,
  androidCancelExamAlarms,
  androidConsumePendingDisableExamId,
  androidGetScheduledAlarmCount,
  androidRequestNotificationPermission,
  androidSchedulePreferenceNotifications,
} from '@/lib/notifications/android-osym-notifications';
import { fetchOsymTakvim } from '@/lib/osym/takvim';
import { getSelectedExamIds, setExamNotificationSelected } from '@/lib/notifications/selected-exams';

const CATEGORY_ID = 'osym_preference_reminder';
const ACTION_DISABLE_EXAM = 'DISABLE_EXAM';

const STORAGE_SCHEDULED_PREFIX = 'notifications:scheduledIds:';
const STORAGE_SCHEDULE_KEY_PREFIX = 'notifications:scheduleKey:';

/** Legacy dev notification storage / migration helpers. */
const STORAGE_DEV_FAST_ID = 'notifications:devFast:id';
const STORAGE_DEV_FAST_EXAM = 'notifications:devFast:examId';
/** Persists expo notification ids for phone test + legacy dev schedules (JSON array). */
const STORAGE_DEV_FAST_IDS = 'notifications:devFast:ids';

/**
 * Mobil bildirim testi: üretim mantığını devre dışı bırakır; bildirimi açtığın her sınav için
 * TEK seferlik hatırlatıcı ~N saniye sonra gelir (TIME_INTERVAL, repeats: false).
 * Mağaza / yayın öncesi mutlaka `false` yap.
 */
const PHONE_NOTIFICATION_TEST_ENABLED = true;
const PHONE_NOTIFICATION_TEST_DELAY_SECONDS = 120;

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
  if (ANDROID_NATIVE_NOTIFICATIONS) return;
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
  if (ANDROID_NATIVE_NOTIFICATIONS) return;
  await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
    {
      identifier: ACTION_DISABLE_EXAM,
      buttonTitle: 'Bu sınav için bildirimi kapat',
      options: { opensAppToForeground: true, isDestructive: true },
    },
  ]);
}

export async function requestNotificationPermission() {
  if (ANDROID_NATIVE_NOTIFICATIONS) {
    return androidRequestNotificationPermission();
  }
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return { granted: true };
  const req = await Notifications.requestPermissionsAsync();
  return { granted: !!req.granted };
}

export async function disableExamNotifications(examId: string) {
  await setExamNotificationSelected(examId, false);
  if (ANDROID_NATIVE_NOTIFICATIONS) {
    await androidCancelExamAlarms(examId);
    return;
  }
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

async function schedulePhoneTestNotificationOnce(
  examId: string,
  examName: string,
  budget: { remaining: number },
) {
  if (budget.remaining <= 0) return;

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Görev tercihi hatırlatma (test)',
        body: `${examName}: yaklaşık ${PHONE_NOTIFICATION_TEST_DELAY_SECONDS}s sonra — mobil bildirim testi.`,
        categoryIdentifier: CATEGORY_ID,
        data: { examId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: PHONE_NOTIFICATION_TEST_DELAY_SECONDS,
        repeats: false,
      },
    });

    budget.remaining -= 1;

    const raw = await AsyncStorage.getItem(STORAGE_DEV_FAST_IDS);
    const list: DevFastEntry[] = raw ? JSON.parse(raw) : [];
    list.push({ id, examId });
    await AsyncStorage.setItem(STORAGE_DEV_FAST_IDS, JSON.stringify(list));
    await AsyncStorage.setItem(getScheduledIdsKey(examId), JSON.stringify([id]));
  } catch {
    // ignore (OS limits, etc.)
  }
}

export async function schedulePreferenceNotificationsDaily_13_25() {
  if (ANDROID_NATIVE_NOTIFICATIONS) {
    const selectedIds = new Set(await getSelectedExamIds());
    const { items } = await fetchOsymTakvim();
    for (const it of items) {
      if (!selectedIds.has(it.id)) {
        await androidCancelExamAlarms(it.id);
      }
    }
    const result = await androidSchedulePreferenceNotifications();
    console.log('[notifications] android native scheduled:', result.scheduled);
    return;
  }

  // When phone test is off, strip any leftover time-interval reminders for our category (test or old dev experiments).
  if (!PHONE_NOTIFICATION_TEST_ENABLED) {
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

  await cancelAllDevFastTestNotifications();

  const budget = {
    remaining: Math.max(6, MAX_SCHEDULED_NOTIFICATIONS_BUDGET - 2),
  };

  for (const it of candidates) {
    if (budget.remaining <= 0) break;
    if (!it.date) continue;
    if (isPast(it.date)) continue;
    if (daysBetween(now, it.date) > SCHEDULING_HORIZON_DAYS) continue;

    if (!selectedIds.has(it.id)) continue;

    const scheduleKey = PHONE_NOTIFICATION_TEST_ENABLED
      ? `${it.id}__PHONE_TEST_${PHONE_NOTIFICATION_TEST_DELAY_SECONDS}`
      : `${it.id}__${it.sinavTarihi}__${REMINDER_HOUR}:${String(REMINDER_MINUTE).padStart(2, '0')}`;

    // Idempotency: only schedule if scheduleKey changed (e.g., date updated).
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

    if (PHONE_NOTIFICATION_TEST_ENABLED) {
      await schedulePhoneTestNotificationOnce(it.id, it.sinav, budget);
    } else {
      await scheduleDailyRemindersForExam(it.id, it.sinav, it.date, budget);
    }
    await AsyncStorage.setItem(getScheduleKeyKey(it.id), scheduleKey);
  }

}

export function attachNotificationResponseListener() {
  const sub = Notifications.addNotificationResponseReceivedListener(async (response) => {
    await processNotificationResponseActions(response);
  });

  return () => sub.remove();
}

/**
 * Root notifications wiring (handlers, listeners, schedules).
 * Implemented here so `_layout.tsx` never imports `expo-notifications` — that crashes web SSR when
 * Node's incomplete `localStorage` triggers inside expo-notifications' web module during render.
 */
export async function bootstrapAppNotifications(): Promise<() => void> {
  if (!ANDROID_NATIVE_NOTIFICATIONS) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }

  await ensureNotificationCategory();
  const detach = attachNotificationResponseListener();
  await flushPendingNotificationResponse();

  if (ANDROID_NATIVE_NOTIFICATIONS) {
    const pendingDisable = await androidConsumePendingDisableExamId();
    if (pendingDisable) {
      await disableExamNotifications(pendingDisable);
    }
  }

  const perm = await requestNotificationPermission();
  console.log('[notifications] permission granted:', perm.granted);
  if (!perm.granted) return detach;

  if (__DEV__ && Platform.OS === 'ios') {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Bildirim testi (1 sn)',
          body: 'Eğer bunu görüyorsan bildirim gösterimi çalışıyor. Seçenekler için bildirime basılı tut.',
          categoryIdentifier: CATEGORY_ID,
          data: { examId: 'dev' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 1,
          repeats: false,
        },
      });
      console.log('[notifications] scheduled immediate test notification:', id);
    } catch (e) {
      console.warn('[notifications] immediate schedule failed', e);
    }
  }

  await schedulePreferenceNotificationsDaily_13_25();

  let appStateSub: { remove: () => void } | undefined;
  if (ANDROID_NATIVE_NOTIFICATIONS) {
    appStateSub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void (async () => {
        const pendingDisable = await androidConsumePendingDisableExamId();
        if (!pendingDisable) return;
        await disableExamNotifications(pendingDisable);
        try {
          await schedulePreferenceNotificationsDaily_13_25();
        } catch {
          // ignore
        }
      })();
    });
  }

  try {
    if (ANDROID_NATIVE_NOTIFICATIONS) {
      const count = await androidGetScheduledAlarmCount();
      console.log('[notifications] android alarm count:', count);
    } else {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      console.log('[notifications] scheduled count:', scheduled.length);
      if (scheduled.length) {
        console.log(
          '[notifications] first scheduled:',
          scheduled[0]?.content?.title,
          scheduled[0]?.content?.body,
          scheduled[0]?.trigger,
        );
      }
    }
  } catch (e) {
    console.warn('[notifications] unable to read scheduled notifications', e);
  }

  return () => {
    detach();
    appStateSub?.remove();
  };
}

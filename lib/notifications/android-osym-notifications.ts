import { Platform } from 'react-native';

import OsymNotifications from 'osym-notifications';

import { fetchOsymTakvim } from '@/lib/osym/takvim';
import { getSelectedExamIds } from '@/lib/notifications/selected-exams';

export const ANDROID_NATIVE_NOTIFICATIONS = Platform.OS === 'android';

const MAX_SCHEDULED_NOTIFICATIONS_BUDGET = 56;
const SCHEDULING_HORIZON_DAYS = 120;
const REMINDER_HOUR = 9;
const REMINDER_MINUTE = 0;

export const PHONE_NOTIFICATION_TEST_ENABLED = true;
export const PHONE_NOTIFICATION_TEST_DELAY_SECONDS = 120;

export async function androidRequestNotificationPermission() {
  if (!ANDROID_NATIVE_NOTIFICATIONS) return { granted: false as const };
  return OsymNotifications.requestPermissions();
}

export async function androidSchedulePreferenceNotifications() {
  if (!ANDROID_NATIVE_NOTIFICATIONS) return { scheduled: 0 };

  const { items } = await fetchOsymTakvim();
  const selectedIds = await getSelectedExamIds();
  const exams = items
    .filter((it) => it.date)
    .map((it) => ({
      id: it.id,
      name: it.sinav,
      examDateMs: it.date!.getTime(),
    }));

  const result = await OsymNotifications.schedulePreferenceReminders({
    exams,
    selectedIds,
    testMode: PHONE_NOTIFICATION_TEST_ENABLED,
    testDelaySeconds: PHONE_NOTIFICATION_TEST_DELAY_SECONDS,
    reminderHour: REMINDER_HOUR,
    reminderMinute: REMINDER_MINUTE,
    horizonDays: SCHEDULING_HORIZON_DAYS,
    maxAlarms: Math.max(6, MAX_SCHEDULED_NOTIFICATIONS_BUDGET - 2),
  });

  return result;
}

export async function androidCancelExamAlarms(examId: string) {
  if (!ANDROID_NATIVE_NOTIFICATIONS) return;
  await OsymNotifications.cancelExamAlarms(examId);
}

export async function androidConsumePendingDisableExamId() {
  if (!ANDROID_NATIVE_NOTIFICATIONS) return null;
  return OsymNotifications.consumePendingDisableExamId();
}

export async function androidGetScheduledAlarmCount() {
  if (!ANDROID_NATIVE_NOTIFICATIONS) return 0;
  return OsymNotifications.getScheduledAlarmCount();
}

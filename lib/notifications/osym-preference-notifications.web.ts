export async function ensureNotificationCategory() {
  // no-op on web
}

export async function requestNotificationPermission() {
  return { granted: false as const };
}

export async function schedulePreferenceNotificationsDaily_13_25() {
  // no-op on web
}

export async function disableExamNotifications(_examId: string) {
  // no-op on web
}

export function attachNotificationResponseListener() {
  return () => {};
}

export async function flushPendingNotificationResponse() {
  // no-op on web
}


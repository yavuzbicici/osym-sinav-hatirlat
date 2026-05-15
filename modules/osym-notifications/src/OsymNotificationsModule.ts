import { NativeModule, requireNativeModule } from 'expo';

import type {
  SchedulePreferenceRemindersOptions,
  SchedulePreferenceRemindersResult,
} from './OsymNotifications.types';

declare class OsymNotificationsNativeModule extends NativeModule {
  schedulePreferenceReminders(
    options: SchedulePreferenceRemindersOptions,
  ): Promise<SchedulePreferenceRemindersResult>;
  cancelAllAlarms(): Promise<void>;
  cancelExamAlarms(examId: string): Promise<void>;
  requestPermissions(): Promise<{ granted: boolean }>;
  consumePendingDisableExamId(): Promise<string | null>;
  getScheduledAlarmCount(): Promise<number>;
}

export default requireNativeModule<OsymNotificationsNativeModule>('OsymNotifications');

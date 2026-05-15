import type {
  SchedulePreferenceRemindersOptions,
  SchedulePreferenceRemindersResult,
} from './OsymNotifications.types';

const webStub = {
  async schedulePreferenceReminders(
    _options: SchedulePreferenceRemindersOptions,
  ): Promise<SchedulePreferenceRemindersResult> {
    return { scheduled: 0 };
  },
  async cancelAllAlarms(): Promise<void> {},
  async cancelExamAlarms(_examId: string): Promise<void> {},
  async requestPermissions(): Promise<{ granted: false }> {
    return { granted: false };
  },
  async consumePendingDisableExamId(): Promise<string | null> {
    return null;
  },
  async getScheduledAlarmCount(): Promise<number> {
    return 0;
  },
};

export default webStub;

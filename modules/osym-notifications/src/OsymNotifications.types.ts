export type ExamScheduleInput = {
  id: string;
  name: string;
  examDateMs: number;
};

export type SchedulePreferenceRemindersOptions = {
  exams: ExamScheduleInput[];
  selectedIds: string[];
  testMode: boolean;
  testDelaySeconds: number;
  reminderHour: number;
  reminderMinute: number;
  horizonDays: number;
  maxAlarms: number;
};

export type SchedulePreferenceRemindersResult = {
  scheduled: number;
};

package expo.modules.osymnotifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class NotificationAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val examId = intent.getStringExtra(OsymNotificationHelper.EXTRA_EXAM_ID) ?: return
    val examName = intent.getStringExtra(OsymNotificationHelper.EXTRA_EXAM_NAME) ?: examId
    val testMode = intent.getBooleanExtra(OsymNotificationHelper.EXTRA_TEST_MODE, false)
    val testDelaySeconds = intent.getIntExtra(OsymNotificationHelper.EXTRA_TEST_DELAY_SECONDS, 120)

    val notificationId = (examId.hashCode() xor intent.hashCode())
    OsymNotificationHelper.showReminderNotification(
      context,
      examId,
      examName,
      testMode,
      testDelaySeconds,
      notificationId,
    )
  }
}

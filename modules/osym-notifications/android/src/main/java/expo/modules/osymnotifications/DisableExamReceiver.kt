package expo.modules.osymnotifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class DisableExamReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != OsymNotificationHelper.ACTION_DISABLE_EXAM) return
    val examId = intent.getStringExtra(OsymNotificationHelper.EXTRA_EXAM_ID) ?: return
    OsymNotificationScheduler.cancelExam(context, examId)
    OsymNotificationScheduler.setPendingDisableExamId(context, examId)
  }
}

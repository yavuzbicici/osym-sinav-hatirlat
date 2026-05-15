package expo.modules.osymnotifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

object OsymNotificationHelper {
  const val CHANNEL_ID = "osym_preference_reminder"
  const val NOTIFICATION_GROUP = "osym_preference_reminders"

  const val EXTRA_EXAM_ID = "examId"
  const val EXTRA_EXAM_NAME = "examName"
  const val EXTRA_TEST_MODE = "testMode"
  const val EXTRA_TEST_DELAY_SECONDS = "testDelaySeconds"

  const val ACTION_DISABLE_EXAM = "expo.modules.osymnotifications.DISABLE_EXAM"

  fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val existing = manager.getNotificationChannel(CHANNEL_ID)
    if (existing != null) return

    val channel = NotificationChannel(
      CHANNEL_ID,
      "Görev tercihi hatırlatmaları",
      NotificationManager.IMPORTANCE_HIGH,
    ).apply {
      description = "Seçtiğiniz sınavlar için görev tercihi hatırlatmaları"
    }
    manager.createNotificationChannel(channel)
  }

  fun showReminderNotification(
    context: Context,
    examId: String,
    examName: String,
    testMode: Boolean,
    testDelaySeconds: Int,
    notificationId: Int,
  ) {
    ensureChannel(context)

    val hint = "Uygulamayı açmak için dokunun."
    val title = if (testMode) "Görev tercihi hatırlatma (test)" else "Görev tercihi hatırlatma"
    val body = if (testMode) {
      "$examName: yaklaşık ${testDelaySeconds}s sonra — mobil bildirim testi."
    } else {
      "$examName için tercih yapabilirsiniz. $hint"
    }

    val tapIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      data = Uri.parse("osymsinavhatirlat:///(tabs)/takvim")
      putExtra(EXTRA_EXAM_ID, examId)
    } ?: Intent(Intent.ACTION_VIEW, Uri.parse("osymsinavhatirlat:///(tabs)/takvim")).apply {
      setPackage(context.packageName)
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      putExtra(EXTRA_EXAM_ID, examId)
    }

    val tapPending = PendingIntent.getActivity(
      context,
      notificationId,
      tapIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val disableIntent = Intent(context, DisableExamReceiver::class.java).apply {
      action = ACTION_DISABLE_EXAM
      putExtra(EXTRA_EXAM_ID, examId)
    }
    val disablePending = PendingIntent.getBroadcast(
      context,
      notificationId + 50_000,
      disableIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setContentIntent(tapPending)
      .setAutoCancel(true)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setGroup(NOTIFICATION_GROUP)
      .addAction(
        android.R.drawable.ic_menu_close_clear_cancel,
        "Bu sınav için bildirimi kapat",
        disablePending,
      )
      .build()

    NotificationManagerCompat.from(context).notify(notificationId, notification)
  }
}

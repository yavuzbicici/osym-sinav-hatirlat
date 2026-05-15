package expo.modules.osymnotifications

import android.Manifest
import android.app.AlarmManager
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class OsymNotificationsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("OsymNotifications")

    AsyncFunction("schedulePreferenceReminders") { options: Map<String, Any?> ->
      val context = appContext.reactContext
      if (context == null) {
        mapOf("scheduled" to 0)
      } else {
        val parsed = ScheduleOptions.fromMap(options)
        val count = OsymNotificationScheduler.schedule(context, parsed)
        mapOf("scheduled" to count)
      }
    }

    AsyncFunction("cancelAllAlarms") {
      val context = appContext.reactContext ?: return@AsyncFunction
      OsymNotificationScheduler.cancelAll(context)
    }

    AsyncFunction("cancelExamAlarms") { examId: String ->
      val context = appContext.reactContext ?: return@AsyncFunction
      OsymNotificationScheduler.cancelExam(context, examId)
    }

    AsyncFunction("requestPermissions") {
      val context = appContext.reactContext ?: return@AsyncFunction mapOf("granted" to false)

      var notificationsGranted = true
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        notificationsGranted = ContextCompat.checkSelfPermission(
          context,
          Manifest.permission.POST_NOTIFICATIONS,
        ) == PackageManager.PERMISSION_GRANTED

        if (!notificationsGranted) {
          val activity = appContext.currentActivity
          if (activity != null) {
            ActivityCompat.requestPermissions(
              activity,
              arrayOf(Manifest.permission.POST_NOTIFICATIONS),
              REQUEST_POST_NOTIFICATIONS,
            )
          }
          notificationsGranted = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.POST_NOTIFICATIONS,
          ) == PackageManager.PERMISSION_GRANTED
        }
      }

      if (!notificationsGranted) {
        return@AsyncFunction mapOf("granted" to false)
      }

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val alarmManager = context.getSystemService(AlarmManager::class.java)
        if (alarmManager != null && !alarmManager.canScheduleExactAlarms()) {
          val activity = appContext.currentActivity
          if (activity != null) {
            val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
              data = Uri.parse("package:${context.packageName}")
            }
            activity.startActivity(intent)
          }
        }
      }

      OsymNotificationHelper.ensureChannel(context)
      mapOf("granted" to true)
    }

    AsyncFunction("consumePendingDisableExamId") {
      val context = appContext.reactContext ?: return@AsyncFunction null
      OsymNotificationScheduler.consumePendingDisableExamId(context)
    }

    AsyncFunction("getScheduledAlarmCount") {
      val context = appContext.reactContext ?: return@AsyncFunction 0
      OsymNotificationScheduler.getScheduledCount(context)
    }
  }

  companion object {
    private const val REQUEST_POST_NOTIFICATIONS = 9101
  }
}

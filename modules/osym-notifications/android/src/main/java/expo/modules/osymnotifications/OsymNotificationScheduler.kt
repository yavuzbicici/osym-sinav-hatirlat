package expo.modules.osymnotifications

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

data class AlarmEntry(
  val requestCode: Int,
  val examId: String,
  val triggerAtMs: Long,
)

object OsymNotificationScheduler {
  private const val PREFS = "osym_notifications_scheduler"
  private const val KEY_ALARMS = "alarms"
  private const val KEY_LAST_SCHEDULE = "last_schedule"
  private const val KEY_PENDING_DISABLE = "pending_disable_exam_id"

  fun schedule(context: Context, options: ScheduleOptions): Int {
    cancelAll(context)
    OsymNotificationHelper.ensureChannel(context)

    val now = System.currentTimeMillis()
    var budget = options.maxAlarms.coerceAtLeast(6)
    val alarms = mutableListOf<AlarmEntry>()

    val candidates = options.exams
      .filter { options.selectedIds.contains(it.id) && it.examDateMs > now }
      .sortedBy { it.examDateMs }

    for (exam in candidates) {
      if (budget <= 0) break

      val daysUntil = ((exam.examDateMs - now) / (24L * 60L * 60L * 1000L)).toInt()
      if (daysUntil > options.horizonDays) continue

      val triggers = if (options.testMode) {
        listOf(now + options.testDelaySeconds.coerceAtLeast(5) * 1000L)
      } else {
        computeProductionTriggers(
          exam.examDateMs,
          options.reminderHour,
          options.reminderMinute,
          now,
        )
      }

      for (triggerAt in triggers) {
        if (budget <= 0) break
        if (triggerAt <= now) continue

        val requestCode = (exam.id.hashCode() xor triggerAt.hashCode())
        scheduleExactAlarm(
          context,
          requestCode,
          triggerAt,
          exam.id,
          exam.name,
          options.testMode,
          options.testDelaySeconds,
        )
        alarms.add(AlarmEntry(requestCode, exam.id, triggerAt))
        budget--
      }
    }

    saveAlarms(context, alarms)
    saveLastSchedule(context, options)
    return alarms.size
  }

  fun computeProductionTriggers(
    examDateMs: Long,
    reminderHour: Int,
    reminderMinute: Int,
    now: Long,
  ): List<Long> {
    val triggers = linkedSetOf<Long>()
    val examCal = Calendar.getInstance().apply { timeInMillis = examDateMs }

    for (daysBefore in 25 downTo 13) {
      triggers.add(atReminderLocal(examCal, daysBefore, reminderHour, reminderMinute))
    }
    for (daysBefore in listOf(10, 3)) {
      triggers.add(atReminderLocal(examCal, daysBefore, reminderHour, reminderMinute))
    }

    return triggers.filter { it > now }.sorted()
  }

  private fun atReminderLocal(
    examCal: Calendar,
    daysBefore: Int,
    hour: Int,
    minute: Int,
  ): Long {
    val cal = examCal.clone() as Calendar
    cal.add(Calendar.DAY_OF_YEAR, -daysBefore)
    cal.set(Calendar.HOUR_OF_DAY, hour)
    cal.set(Calendar.MINUTE, minute)
    cal.set(Calendar.SECOND, 0)
    cal.set(Calendar.MILLISECOND, 0)
    return cal.timeInMillis
  }

  private fun scheduleExactAlarm(
    context: Context,
    requestCode: Int,
    triggerAtMs: Long,
    examId: String,
    examName: String,
    testMode: Boolean,
    testDelaySeconds: Int,
  ) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val intent = Intent(context, NotificationAlarmReceiver::class.java).apply {
      putExtra(OsymNotificationHelper.EXTRA_EXAM_ID, examId)
      putExtra(OsymNotificationHelper.EXTRA_EXAM_NAME, examName)
      putExtra(OsymNotificationHelper.EXTRA_TEST_MODE, testMode)
      putExtra(OsymNotificationHelper.EXTRA_TEST_DELAY_SECONDS, testDelaySeconds)
    }

    val pendingIntent = PendingIntent.getBroadcast(
      context,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, pendingIntent)
    } else {
      alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMs, pendingIntent)
    }
  }

  fun cancelAll(context: Context) {
    val alarms = loadAlarms(context)
    cancelAlarmEntries(context, alarms)
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .remove(KEY_ALARMS)
      .apply()
  }

  fun cancelExam(context: Context, examId: String) {
    val alarms = loadAlarms(context)
    val (toCancel, remaining) = alarms.partition { it.examId == examId }
    cancelAlarmEntries(context, toCancel)
    saveAlarms(context, remaining)

    val last = loadLastSchedule(context) ?: return
    val updatedExams = last.exams
    val updatedSelected = last.selectedIds - examId
    val updated = last.copy(selectedIds = updatedSelected)
    saveLastSchedule(context, updated)
  }

  private fun cancelAlarmEntries(context: Context, alarms: List<AlarmEntry>) {
    val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    for (entry in alarms) {
      val intent = Intent(context, NotificationAlarmReceiver::class.java)
      val pendingIntent = PendingIntent.getBroadcast(
        context,
        entry.requestCode,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
      alarmManager.cancel(pendingIntent)
      pendingIntent.cancel()
    }
  }

  fun getScheduledCount(context: Context): Int = loadAlarms(context).size

  fun consumePendingDisableExamId(context: Context): String? {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val examId = prefs.getString(KEY_PENDING_DISABLE, null) ?: return null
    prefs.edit().remove(KEY_PENDING_DISABLE).apply()
    return examId
  }

  fun setPendingDisableExamId(context: Context, examId: String) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_PENDING_DISABLE, examId)
      .apply()
  }

  fun rescheduleFromLastSaved(context: Context) {
    val last = loadLastSchedule(context) ?: return
    schedule(context, last)
  }

  private fun saveAlarms(context: Context, alarms: List<AlarmEntry>) {
    val arr = JSONArray()
    for (a in alarms) {
      arr.put(
        JSONObject()
          .put("requestCode", a.requestCode)
          .put("examId", a.examId)
          .put("triggerAtMs", a.triggerAtMs),
      )
    }
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_ALARMS, arr.toString())
      .apply()
  }

  private fun loadAlarms(context: Context): List<AlarmEntry> {
    val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_ALARMS, null)
      ?: return emptyList()
    return try {
      val arr = JSONArray(raw)
      buildList {
        for (i in 0 until arr.length()) {
          val obj = arr.getJSONObject(i)
          add(
            AlarmEntry(
              requestCode = obj.getInt("requestCode"),
              examId = obj.getString("examId"),
              triggerAtMs = obj.getLong("triggerAtMs"),
            ),
          )
        }
      }
    } catch (_: Exception) {
      emptyList()
    }
  }

  private fun saveLastSchedule(context: Context, options: ScheduleOptions) {
    val obj = JSONObject()
      .put("testMode", options.testMode)
      .put("testDelaySeconds", options.testDelaySeconds)
      .put("reminderHour", options.reminderHour)
      .put("reminderMinute", options.reminderMinute)
      .put("horizonDays", options.horizonDays)
      .put("maxAlarms", options.maxAlarms)

    val examsArr = JSONArray()
    for (exam in options.exams) {
      examsArr.put(
        JSONObject()
          .put("id", exam.id)
          .put("name", exam.name)
          .put("examDateMs", exam.examDateMs),
      )
    }
    obj.put("exams", examsArr)

    val selectedArr = JSONArray()
    for (id in options.selectedIds) {
      selectedArr.put(id)
    }
    obj.put("selectedIds", selectedArr)

    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_LAST_SCHEDULE, obj.toString())
      .apply()
  }

  private fun loadLastSchedule(context: Context): ScheduleOptions? {
    val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .getString(KEY_LAST_SCHEDULE, null) ?: return null
    return try {
      val obj = JSONObject(raw)
      val examsArr = obj.getJSONArray("exams")
      val exams = buildList {
        for (i in 0 until examsArr.length()) {
          val row = examsArr.getJSONObject(i)
          add(
            ExamInput(
              id = row.getString("id"),
              name = row.getString("name"),
              examDateMs = row.getLong("examDateMs"),
            ),
          )
        }
      }
      val selectedArr = obj.getJSONArray("selectedIds")
      val selected = buildSet {
        for (i in 0 until selectedArr.length()) {
          add(selectedArr.getString(i))
        }
      }
      ScheduleOptions(
        exams = exams,
        selectedIds = selected,
        testMode = obj.optBoolean("testMode", false),
        testDelaySeconds = obj.optInt("testDelaySeconds", 120),
        reminderHour = obj.optInt("reminderHour", 9),
        reminderMinute = obj.optInt("reminderMinute", 0),
        horizonDays = obj.optInt("horizonDays", 120),
        maxAlarms = obj.optInt("maxAlarms", 54),
      )
    } catch (_: Exception) {
      null
    }
  }
}

package expo.modules.osymnotifications

data class ExamInput(
  val id: String,
  val name: String,
  val examDateMs: Long,
)

data class ScheduleOptions(
  val exams: List<ExamInput>,
  val selectedIds: Set<String>,
  val testMode: Boolean,
  val testDelaySeconds: Int,
  val reminderHour: Int,
  val reminderMinute: Int,
  val horizonDays: Int,
  val maxAlarms: Int,
) {
  companion object {
    @Suppress("UNCHECKED_CAST")
    fun fromMap(map: Map<String, Any?>): ScheduleOptions {
      val examsRaw = map["exams"] as? List<Map<String, Any?>> ?: emptyList()
      val exams = examsRaw.mapNotNull { row ->
        val id = row["id"]?.toString() ?: return@mapNotNull null
        val name = row["name"]?.toString() ?: return@mapNotNull null
        val examDateMs = (row["examDateMs"] as? Number)?.toLong() ?: return@mapNotNull null
        ExamInput(id, name, examDateMs)
      }

      val selectedRaw = map["selectedIds"] as? List<*> ?: emptyList<Any>()
      val selectedIds = selectedRaw.map { it.toString() }.toSet()

      return ScheduleOptions(
        exams = exams,
        selectedIds = selectedIds,
        testMode = map["testMode"] as? Boolean ?: false,
        testDelaySeconds = (map["testDelaySeconds"] as? Number)?.toInt() ?: 120,
        reminderHour = (map["reminderHour"] as? Number)?.toInt() ?: 9,
        reminderMinute = (map["reminderMinute"] as? Number)?.toInt() ?: 0,
        horizonDays = (map["horizonDays"] as? Number)?.toInt() ?: 120,
        maxAlarms = (map["maxAlarms"] as? Number)?.toInt() ?: 54,
      )
    }
  }
}

# Changelog

## [1.0.1] - September 3, 2026

### Fixed

* **Leave status now takes precedence over attendance punches.**

  * Days marked as `on_leave` are treated as leave even when attendance punches exist.
  * Applies to Daily Logs, the calendar, and the member dashboard.

* **Excluded leave days from attendance calculations.**

  * `on_leave` days are no longer counted toward **Days Present**.
  * `on_leave` days are excluded from the **Monthly On-Time Rate** denominator, even when punches exist.

* **Excluded leave days from weekly logged hours.**

  * Punches recorded on `on_leave` days do not contribute to **Logged Hours This Week**.
  * Punch times remain visible in Daily Logs and the calendar for reference.

### Updated

* **`resources/js/utils/attendance-processor.ts`**

  * Updated attendance processing to evaluate leave status before attendance punches.
  * Excluded leave days from attendance and weekly hour calculations.
  * Preserved punch times for display purposes.

* **`resources/js/components/attendance/edit-day-dialog.tsx`**

  * Updated the warning message displayed when a day contains attendance punches but is marked as `on_leave`.

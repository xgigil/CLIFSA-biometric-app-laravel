# Changelog

## [1.0.2] - Company holidays and bulk leave entry

### Added

* **Admin ability to set company holidays.**

  * Holidays are stored in a dedicated `company_holidays` table instead of per-employee leave rows.
  * Holiday status takes precedence over attendance punches and leave, except weekends.
  * Setting a holiday is blocked if any employee already has an approved `on_leave` status in the selected range; those leaves must be removed first.
  * Holiday handling does not interfere with the existing on-leave checker.

* **Bulk on-leave entry for all employees.**

  * Admins can apply leave to every active employee in one action.
  * Employees already on leave for the selected range are skipped.

* **UI updates for holiday and leave workflows.**

  * Sidebar actions for setting holidays and leave.
  * Calendar and related views updated to display holiday status.

### Updated

* **`database/migrations/2026_09_07_015639_create_company_holidays_table.php`**

  * Added `company_holidays` table and migrated existing holiday leave rows into company holidays.

* **`resources/js/app/dashboard/holidays/actions.ts`**

  * Added admin actions to fetch, set, and remove company holidays.
  * Enforced leave-conflict and overlap checks before creating holidays.

* **`resources/js/app/dashboard/leaves/actions.ts`**

  * Added bulk leave action for all active employees.
  * Blocked leave creation on holiday dates and removed holiday as a leave type.

* **`resources/js/utils/attendance-processor.ts`**

  * Integrated holiday indexing and status evaluation.
  * Applied holiday precedence after weekends, before leave and punches.
  * Excluded holiday days from attendance and weekly hour calculations.

* **`resources/js/components/attendance/set-holiday-dialog.tsx`**

  * Added dialog for creating and managing company holidays.

* **`resources/js/components/attendance/set-leave-dialog.tsx`**

  * Added option to apply leave to all employees.

* **`resources/js/components/app-sidebar.tsx`**

  * Added sidebar entry points for Set Holiday and related admin actions.

## [1.0.1] - Prioritize leave status over attendance punches

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

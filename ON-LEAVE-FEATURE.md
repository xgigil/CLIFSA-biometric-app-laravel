# On-Leave Attendance Feature

A rundown of everything added to support marking employees as **On Leave** instead of
**Absent**, and the groundwork for scheduling leave in advance.

Attendance statuses are now: **Present**, **Late**, **Absent**, **On Leave**.

---

## 1. Read this first: there are two copies of the app

The React/Next.js code exists in two places, and only one of them actually runs:

| Location | Runs? | Notes |
| --- | --- | --- |
| `Ver1 Biometric Attendance\Biometric-Attendance-Dashboard-main\src\` | **Yes** | `pnpm dev` here serves **localhost:3000** |
| `biometric-attendance-app-laravel\resources\js\` | No | No `package.json`, `next.config.ts`, `tsconfig.json` or `node_modules` |

`resources/js` is a staging copy for the eventual Laravel + Inertia port. Nothing
executes it today. Laravel's own `pnpm dev` runs Vite on port 5173, and
`php artisan serve` runs on 8000 — neither has anything to do with Next.js.

**Every change described below was applied to both trees.** If you edit one and not the
other, the app will appear not to pick up your fix.

> Quick rule: if an error message shows a path starting with `src/`, the file to edit is
> in the Ver1 project. Only that tree has a `src/` folder.

---

## 2. Data model

### New table: `employee_leaves`

Created by `database/migrations/2026_08_25_061725_create_employee_leaves_table.php`,
and documented in `mysql/schema.sql`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `INT UNSIGNED` auto-increment | Primary key |
| `employee_id` | `INT` | FK → `employees.employee_id`, cascade delete |
| `start_date` | `DATE` | Inclusive |
| `end_date` | `DATE` | Inclusive; equals `start_date` for a single day |
| `leave_type` | `VARCHAR(32)` | Defaults to `vacation` |
| `note` | `VARCHAR(255)` | Nullable |
| `status` | `VARCHAR(32)` | Defaults to `approved`; only approved rows are read |
| `created_by` | `CHAR(36)` | Nullable UUID of the admin who created it |
| `created_at` | `DATETIME` | Defaults to `CURRENT_TIMESTAMP` |

Indexed on `(employee_id, start_date, end_date)` as `leaves_emp_range`.

### Why a separate table rather than a column on the logs

`hik_biometric_logs` holds raw scans written by the Hikvision device. An absent day has
**zero rows** there — which is exactly the day you need to mark as leave. Storing leave on
that table would require inserting fake punch rows into data an external device owns, one
per leave day, and would break advance scheduling (leave is a range; punches are single
moments).

### One-time database fix already applied

The table was originally created without a default on `created_at`, which made every
insert fail with `Field 'created_at' doesn't have a default value`. Fixed directly:

```sql
ALTER TABLE employee_leaves MODIFY created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
```

The migration file already declares `useCurrent()`, so a fresh `php artisan migrate` on a
clean database produces the correct schema. Only the existing local table was stale.

---

## 3. How status is decided

**Status is derived, never stored.** Nothing in the database says "this day is late" — it
is recomputed on every render from the punches plus the leave rows. This matters: you
cannot "set" a day to Present, because Present is simply what you get when a punch exists.
The only writable fact is the leave flag.

### Daily Logs (`processDailyLogs`, `processUserHistoryLogs`)

1. Punches exist → `present` or `late`, depending on the grace-period cutoff
2. No punches, day is covered by an approved leave → `on_leave`
3. No punches, no leave → `absent`

### Calendar (`generateMonthlyCalendarMatrix`)

Evaluated strictly in this order:

1. Weekend → `weekend`
2. Punches exist → `late` or `on_time`
3. Covered by leave → `on_leave`
4. Date is after today → `future`
5. Otherwise → `absent`

**Punches always beat leave.** If someone on leave scans in, the day shows their real
attendance rather than the leave. This is deliberate — the scan is evidence they worked.

---

## 4. Server actions — `app/dashboard/leaves/actions.ts`

All three are admin-gated via `checkIsAdmin`, which reads `profiles.role`. Writes go
through `createAdminClient`.

### `getLeavesForRangedAction(startDate, endDate, employeeId?)`

Returns approved leave rows overlapping the range, including `id` — which the pages'
inline queries deliberately omit. This is how the UI finds a leave row in order to delete
it. The overlap test is `start_date <= endDate AND end_date >= startDate`, pure AND, so it
works within `db-client.ts`'s lack of `OR` support.

### `setLeaveAction({ employee_id, start_date, end_date, leave_type?, note? })`

Validates both dates against `YYYY-MM-DD` and rejects an end before a start. Then runs an
**overlap guard** — if any approved leave already touches that range for that employee, it
returns an error instead of inserting.

That guard exists because without it, a double-click creates two overlapping rows.
Display-wise you would not notice, since `buildLeaveIndex` writes into a `Set` and
duplicate keys collapse. But removal deletes one row by ID, so the day would stay on leave
and the delete would look broken.

### `removeLeaveAction(id)`

Deletes one leave row by primary key. **This removes the entire range**, not a single day —
see limitations below.

All three call `revalidatePath` for `/dashboard`, `/dashboard/analytics` and
`/dashboard/calendar`, so views refresh themselves after a write.

---

## 5. Core logic — `utils/attendance-processor.ts`

### New types and helpers

```ts
export type LeaveRow = { employee_id: number; start_date: string; end_date: string };
export type LeaveIndex = Set<string>;

export function buildLeaveIndex(leaves: LeaveRow[]): LeaveIndex
export function isOnLeave(index: LeaveIndex, empId: number | string, dateStr: string): boolean
```

`buildLeaveIndex` expands each date range into individual `"<empId>|YYYY-MM-DD"` keys in a
`Set`, so a lookup is O(1) instead of scanning ranges per day. It walks dates at UTC noon
to sidestep daylight-saving edges, and is capped at 366 days per row as a runaway guard.

`LeaveIndex` is a `Set`, which does **not** survive React's server-to-client boundary.
Server components build it inline; client components receive a plain `LeaveRow[]` and build
the index themselves inside `useMemo`.

### Signature changes

All three take an optional trailing `leaveIndex: LeaveIndex = new Set()`, so existing
callers keep working:

- `processDailyLogs(logs, allEmployees, workStartTime, gracePeriod, dateStr?, leaveIndex?)`
- `processUserHistoryLogs(logs, employee, workStartTime, gracePeriod, selectedDate?, leaveIndex?)`
- `generateMonthlyCalendarMatrix(logs, empId, year, month, workStartTime, gracePeriod, todayStr, leaveIndex?)`

`CalendarDayStatus["status"]` gained `"on_leave"` alongside the existing five values.

In `processDailyLogs` the check is guarded, because its date parameter is optional:

```ts
const onLeave = !!dateStr && isOnLeave(leaveIndex, empId, dateStr);
```

With no date there is no day to test, so it resolves to `false`. The other two call sites
always have a date and need no guard.

---

## 6. Page wiring

Each page fetches approved leave rows overlapping the window it displays, then builds the
index and passes it down.

| File | What it fetches | Passed to |
| --- | --- | --- |
| `app/dashboard/page.tsx` | The current week | `processDailyLogs` |
| `app/dashboard/analytics/page.tsx` | One day for admins, the whole month for members | `processDailyLogs` / `processUserHistoryLogs` |
| `app/dashboard/calendar/page.tsx` | The displayed month for the selected employee | `CalendarView` as a `leaves` array |

The calendar path deliberately passes raw rows rather than an index, because that data
crosses into a client component. `calendar-view.tsx` forwards `leaves` to
`employee-attendance-calendar.tsx`, which calls `buildLeaveIndex` in a `useMemo`.

---

## 7. UI

### `components/employee-attendance-calendar.tsx`

Accepts a `leaves` prop, builds the index client-side, and renders a blue **On Leave**
badge in both the month grid cell and the day-detail dialog. The italic "No scan" label is
suppressed on leave days — without that, a cell would read "On Leave" and "No scan"
simultaneously, which looks like a bug.

### `app/dashboard/analytics/columns.tsx`

The status column has an `on_leave` entry using a blue `IconCalendar`. Row actions are now:

- **Edit Day** (pencil) — always enabled, opens the day-level dialog below
- **Delete** (trash) — unchanged, with a dropdown to pick a punch when there are several

The previous per-punch Edit dropdown was removed, since the Edit Day dialog covers it.
`rawLogs` is wrapped in `useMemo` because it feeds the dialog's effect dependencies, and
`row.original.raw_logs || []` would otherwise produce a new array reference on every
render and loop forever.

### `components/attendance/edit-day-dialog.tsx` (new)

The main answer to "leave should be editable as part of the attendance record". It opens
for **any** row, including absent employees with no log record — previously Edit and
Delete both refused those rows with "No log record available for editing", which was
precisely the case where leave needed marking.

Inside: a list of the day's punches, each with a time input and a staged remove (with
undo, so nothing is destroyed until Save); an "Add punch" control; and a leave section
that either shows the existing leave with a Remove control, or offers a checkbox, type
selector and note.

Save applies everything in one pass — deletions, then edits, then additions, then the
leave change — collecting failures rather than stopping at the first.

Two warnings are surfaced rather than left implicit. Marking leave on a day that has
punches tells you the row will still read Present or Late, because punches take
precedence. Removing a leave that spans several days tells you the whole range is going,
not just this day.

### `components/attendance/set-leave-dialog.tsx`

Reached from the sidebar's **Set Leave** button (admins only). Handles multi-day ranges
and future dates, which is the advance-scheduling path. Employee dropdown, start and end
dates, leave type, optional note.

Edit Day intentionally only sets **single-day** leave and points here for ranges, so the
two dialogs cannot disagree about what a leave is.

### `components/status-filter.tsx`

`FILTERABLE_STATUSES` includes `on_leave`, so the Daily Logs table can filter by it.

---

## 8. Known limitations

**A leave range cannot be trimmed.** Removing leave from one day of a multi-day range
deletes the whole range, because `removeLeaveAction` deletes by ID. Splitting a row into
two is not something the action can express today. The UI warns instead of pretending.

**Leave on a day with punches is invisible in the table.** Punches win, so the row shows
Present or Late. The leave row still exists and the Edit Day dialog will show it, but the
status column gives no hint.

**No leave management list.** There is no page listing all upcoming leave with delete
buttons. That is the natural next step for advance scheduling — it would also cover the
case above, since it works from leave rows directly rather than from a derived status.

**`leave_type` and `note` are not surfaced in the tables.** They are stored and shown in
the dialogs, but the Daily Logs and calendar views only show that a day is on leave.

**`status` is always `approved`.** The column exists for a future approval workflow;
nothing currently writes any other value, and every read filters on `approved`.

---

## 9. Files touched

### Laravel repo

```
database/migrations/2026_08_25_061725_create_employee_leaves_table.php   new
mysql/schema.sql                                                        employee_leaves added
ON-LEAVE-FEATURE.md                                                     this file
```

### Both React trees (`resources/js/` and Ver1 `src/`)

```
app/dashboard/leaves/actions.ts                     new
components/attendance/set-leave-dialog.tsx          new
components/attendance/edit-day-dialog.tsx           new

utils/attendance-processor.ts                       leave index, helpers, status precedence
app/dashboard/page.tsx                              leave query + index
app/dashboard/analytics/page.tsx                    leave query + index
app/dashboard/analytics/columns.tsx                 on_leave badge, Edit Day action
app/dashboard/calendar/page.tsx                     leave query
app/dashboard/calendar/calendar-view.tsx            leaves passthrough
components/employee-attendance-calendar.tsx         on_leave styling + index
components/app-sidebar.tsx                          Set Leave button
components/status-filter.tsx                        on_leave filter
```

### Now unused, left on disk

```
components/attendance/edit-attendance-dialog.tsx    superseded by edit-day-dialog.tsx
```

---

## 10. Running it

```powershell
# Database
docker compose up -d
php artisan migrate

# The app
cd "C:\Users\Admin\Documents\Project\CLIFSA\Ver1 Biometric Attendance\Biometric-Attendance-Dashboard-main"
pnpm dev     # http://localhost:3000
```

Docker MySQL must be running — `.env.local` points at `127.0.0.1:3307`, the same database
Laravel migrates.

A good first test is an **absent employee row** in Daily Logs. That path was unreachable
before this work, and it exercises the whole chain: Edit Day opening without a log record,
`setLeaveAction` inserting, `revalidatePath` refreshing, and the status flipping from
Absent to On Leave.

import { describe, it, expect } from "vitest";
import {
  processDailyLogs,
  processUserHistoryLogs,
  calculateEmployeePersonalStats,
  generateMonthlyCalendarMatrix,
  RawBiometricLog,
} from "./attendance-processor";

describe("processDailyLogs", () => {
  const mockEmployees = [
    { employee_id: 1, employee_name: "Alice Smith" },
    { employee_id: 2, employee_name: "Bob Jones" },
    { employee_id: 3, employee_name: "Charlie Brown" },
  ];

  it("should mark unlogged employees as absent with 0 hours", () => {
    const logs: Parameters<typeof processDailyLogs>[0] = [];
    const result = processDailyLogs(logs, mockEmployees);

    expect(result).toHaveLength(3);
    const charlie = result.find((r) => r.employee_id === "3");
    expect(charlie).toEqual({
      employee_id: "3",
      employee_name: "Charlie Brown",
      first_punch: null,
      last_punch: null,
      total_hours_worked: 0,
      status: "absent",
      log_id: undefined,
      raw_logs: [],
    });
  });

  it("should filter out duplicate scans within 2 minutes of the previous scan", () => {
    const logs = [
      {
        id: 1,
        employee_id: 1,
        employee_name: "Alice Smith",
        log_date_time: "2026-06-22T08:00:00.000Z",
        log_time: "08:00:00",
        log_date: "2026-06-22",
      },
      {
        id: 2,
        employee_id: 1,
        employee_name: "Alice Smith",
        log_date_time: "2026-06-22T08:01:30.000Z",
        log_time: "08:01:30",
        log_date: "2026-06-22",
      },
      {
        id: 3,
        employee_id: 1,
        employee_name: "Alice Smith",
        log_date_time: "2026-06-22T17:00:00.000Z",
        log_time: "17:00:00",
        log_date: "2026-06-22",
      },
    ];

    const result = processDailyLogs(logs, mockEmployees);
    const alice = result.find((r) => r.employee_id === "1");

    expect(alice).toBeDefined();
    expect(alice?.first_punch).toBe("2026-06-22T08:00:00.000Z");
    expect(alice?.last_punch).toBe("2026-06-22T17:00:00.000Z");
    // Diff is 9 hours. Since hours > 5, 1 hour break is deducted.
    // 9 - 1 = 8 hours
    expect(alice?.total_hours_worked).toBe(8);
  });

  it("should calculate correct status: late if after 08:00, present if at or before 08:00", () => {
    const logs = [
      {
        id: 1,
        employee_id: 1,
        employee_name: "Alice Smith",
        log_date_time: "2026-06-22T08:00:00.000Z",
        log_time: "08:00:00",
        log_date: "2026-06-22",
      },
      {
        id: 2,
        employee_id: 2,
        employee_name: "Bob Jones",
        log_date_time: "2026-06-22T08:01:00.000Z",
        log_time: "08:01:00",
        log_date: "2026-06-22",
      },
    ];

    const result = processDailyLogs(logs, mockEmployees);
    const alice = result.find((r) => r.employee_id === "1");
    const bob = result.find((r) => r.employee_id === "2");

    expect(alice?.status).toBe("present");
    expect(bob?.status).toBe("late");
  });

  it("should sort raw logs chronologically by date-time before processing", () => {
    const logs = [
      {
        id: 1,
        employee_id: 1,
        employee_name: "Alice Smith",
        log_date_time: "2026-06-22T17:00:00.000Z",
        log_time: "17:00:00",
        log_date: "2026-06-22",
      },
      {
        id: 2,
        employee_id: 1,
        employee_name: "Alice Smith",
        log_date_time: "2026-06-22T08:00:00.000Z",
        log_time: "08:00:00",
        log_date: "2026-06-22",
      },
    ];

    const result = processDailyLogs(logs, mockEmployees);
    const alice = result.find((r) => r.employee_id === "1");

    expect(alice?.first_punch).toBe("2026-06-22T08:00:00.000Z");
    expect(alice?.last_punch).toBe("2026-06-22T17:00:00.000Z");
  });

  it("should deduct 1 hour break when total hours worked is greater than 5 hours", () => {
    const logs1 = [
      {
        id: 1,
        employee_id: 1,
        employee_name: "Alice Smith",
        log_date_time: "2026-06-22T08:00:00.000Z",
        log_time: "08:00:00",
        log_date: "2026-06-22",
      },
      {
        id: 2,
        employee_id: 1,
        employee_name: "Alice Smith",
        log_date_time: "2026-06-22T14:00:00.000Z",
        log_time: "14:00:00",
        log_date: "2026-06-22",
      },
    ];

    const logs2 = [
      {
        id: 3,
        employee_id: 2,
        employee_name: "Bob Jones",
        log_date_time: "2026-06-22T08:00:00.000Z",
        log_time: "08:00:00",
        log_date: "2026-06-22",
      },
      {
        id: 4,
        employee_id: 2,
        employee_name: "Bob Jones",
        log_date_time: "2026-06-22T13:00:00.000Z",
        log_time: "13:00:00",
        log_date: "2026-06-22",
      },
    ];

    const result1 = processDailyLogs(logs1, mockEmployees);
    const result2 = processDailyLogs(logs2, mockEmployees);

    const alice = result1.find((r) => r.employee_id === "1");
    const bob = result2.find((r) => r.employee_id === "2");

    expect(alice?.total_hours_worked).toBe(5);
    expect(bob?.total_hours_worked).toBe(5);
  });

  it("should handle employees with a single punch by setting last_punch to null and 0 hours worked", () => {
    const logs = [
      {
        id: 1,
        employee_id: 1,
        employee_name: "Alice Smith",
        log_date_time: "2026-06-22T08:00:00.000Z",
        log_time: "08:00:00",
        log_date: "2026-06-22",
      },
    ];

    const result = processDailyLogs(logs, mockEmployees);
    const alice = result.find((r) => r.employee_id === "1");

    expect(alice?.first_punch).toBe("2026-06-22T08:00:00.000Z");
    expect(alice?.last_punch).toBeNull();
    expect(alice?.total_hours_worked).toBe(0);
  });

  it("should calculate correct status based on workStartTime and gracePeriod parameters", () => {
    const logs = [
      {
        id: 1,
        employee_id: 1,
        employee_name: "Alice Smith",
        log_date_time: "2026-06-22T09:10:00.000Z",
        log_time: "09:10:00",
        log_date: "2026-06-22",
      },
      {
        id: 2,
        employee_id: 2,
        employee_name: "Bob Jones",
        log_date_time: "2026-06-22T09:20:00.000Z",
        log_time: "09:20:00",
        log_date: "2026-06-22",
      },
    ];

    // Under workStartTime 09:00 and gracePeriod 15 (cutoff 09:15)
    const result = processDailyLogs(logs, mockEmployees, "09:00", 15);
    const alice = result.find((r) => r.employee_id === "1");
    const bob = result.find((r) => r.employee_id === "2");

    expect(alice?.status).toBe("present"); // 09:10 <= 09:15
    expect(bob?.status).toBe("late");    // 09:20 > 09:15
  });
});

describe("processUserHistoryLogs", () => {
  const employee = { employee_id: 1, employee_name: "Alice Smith" };

  it("should return an empty array if logs is empty", () => {
    const result = processUserHistoryLogs([], employee);
    expect(result).toEqual([]);
  });

  it("should group logs by date, sort dates descending, and attach date string to each PersonnelAnalytics record", () => {
    const logs = [
      {
        id: 1,
        employee_id: 1,
        employee_name: "Alice Smith",
        log_date_time: "2026-06-21T08:00:00.000Z",
        log_time: "08:00:00",
        log_date: "2026-06-21",
      },
      {
        id: 2,
        employee_id: 1,
        employee_name: "Alice Smith",
        log_date_time: "2026-06-21T17:00:00.000Z",
        log_time: "17:00:00",
        log_date: "2026-06-21",
      },
      {
        id: 3,
        employee_id: 1,
        employee_name: "Alice Smith",
        log_date_time: "2026-06-23T08:30:00.000Z",
        log_time: "08:30:00",
        log_date: "2026-06-23",
      },
      {
        id: 4,
        employee_id: 1,
        employee_name: "Alice Smith",
        log_date_time: "2026-06-22T08:00:00.000Z",
        log_time: "08:00:00",
        log_date: "2026-06-22",
      },
    ];

    const result = processUserHistoryLogs(logs, employee, "08:00", 15);

    // Verify descending sort order across all generated dates
    const dates = result.map((r) => r.date || "");
    const expectedSorted = [...dates].sort((a, b) => b.localeCompare(a));
    expect(dates).toEqual(expectedSorted);

    const rec23 = result.find((r) => r.date === "2026-06-23");
    const rec22 = result.find((r) => r.date === "2026-06-22");
    const rec21 = result.find((r) => r.date === "2026-06-21");

    expect(rec23).toBeDefined();
    expect(rec22).toBeDefined();
    expect(rec21).toBeDefined();

    // Check 2026-06-23 record (log at 08:30 with workStartTime 08:00, gracePeriod 15 => late)
    expect(rec23?.employee_id).toBe("1");
    expect(rec23?.status).toBe("late");

    // Check 2026-06-21 record (hours logged)
    expect(rec21?.total_hours_worked).toBe(8);
  });

  it("should generate absent records for missing weekdays and exclude weekends", () => {
    const mockEmployee = { employee_id: 1, employee_name: "Alice Smith" };
    const logs = [
      {
        id: 1,
        employee_id: 1,
        employee_name: "Alice Smith",
        log_date_time: "2026-06-19T08:00:00.000Z",
        log_time: "08:00:00",
        log_date: "2026-06-19",
      },
      {
        id: 2,
        employee_id: 1,
        employee_name: "Alice Smith",
        log_date_time: "2026-06-23T08:00:00.000Z",
        log_time: "08:00:00",
        log_date: "2026-06-23",
      },
    ];

    const result = processUserHistoryLogs(logs, mockEmployee, "08:00", 0);

    const dates = result.map((r) => r.date || "");
    expect(dates).toContain("2026-06-19");
    expect(dates).toContain("2026-06-22");
    expect(dates).toContain("2026-06-23");
    expect(dates).not.toContain("2026-06-20");
    expect(dates).not.toContain("2026-06-21");

    const mon = result.find((r) => r.date === "2026-06-22");
    expect(mon?.status).toBe("absent");
  });

  it("should restrict evaluated dates to the target month when selectedDate is provided", () => {
    const mockEmployee = { employee_id: 1, employee_name: "Alice Smith" };
    const logs = [
      {
        id: 1,
        employee_id: 1,
        employee_name: "Alice Smith",
        log_date_time: "2026-06-15T08:00:00.000Z",
        log_time: "08:00:00",
        log_date: "2026-06-15",
      },
    ];

    // Evaluate for June 2026 when selectedDate is "2026-06-01"
    const result = processUserHistoryLogs(logs, mockEmployee, "08:00", 0, "2026-06-01");

    const dates = result.map((r) => r.date || "");
    expect(dates.length).toBeGreaterThan(0);
    expect(dates.every((d) => d.startsWith("2026-06-"))).toBe(true);
    expect(dates).not.toContain("2026-07-01");
  });
});

describe("calculateEmployeePersonalStats", () => {
  it("calculates monthly on-time rate, weekly hours, late count, and present days correctly", () => {
    const mockLogs: RawBiometricLog[] = [
      { id: 1, employee_id: 101, employee_name: "Alice", log_date: "2026-07-06", log_time: "08:50:00", log_date_time: "2026-07-06T08:50:00Z" },
      { id: 2, employee_id: 101, employee_name: "Alice", log_date: "2026-07-06", log_time: "17:00:00", log_date_time: "2026-07-06T17:00:00Z" },
      { id: 3, employee_id: 101, employee_name: "Alice", log_date: "2026-07-07", log_time: "09:30:00", log_date_time: "2026-07-07T09:30:00Z" },
      { id: 4, employee_id: 101, employee_name: "Alice", log_date: "2026-07-07", log_time: "17:00:00", log_date_time: "2026-07-07T17:00:00Z" },
    ];
    const monthDates = ["2026-07-06", "2026-07-07", "2026-07-08"]; // 3 workdays
    const stats = calculateEmployeePersonalStats(mockLogs, 101, "09:00", 15, monthDates, "2026-07-07");
    expect(stats.presentDaysCount).toBe(2);
    expect(stats.lateCount).toBe(1);
    expect(stats.onTimeRatePercent).toBe(50);
    expect(stats.avgLateMins).toBe(30);
    expect(stats.elapsedWorkdaysCount).toBe(2);
    expect(stats.loggedHoursThisWeek).toBe(13.67);
    expect(stats.todayStatus.state).toBe("checked_out");
    expect(stats.todayStatus.firstPunch).toBe("2026-07-07T09:30:00Z");
    expect(stats.todayStatus.lastPunch).toBe("2026-07-07T17:00:00Z");
  });

  it("handles todayStatus with no scans (not_scanned) and single scan (checked_in)", () => {
    const mockLogs: RawBiometricLog[] = [
      { id: 1, employee_id: 101, employee_name: "Alice", log_date: "2026-07-07", log_time: "08:50:00", log_date_time: "2026-07-07T08:50:00Z" },
    ];
    const monthDates = ["2026-07-07"];
    const stats1 = calculateEmployeePersonalStats(mockLogs, 101, "09:00", 15, monthDates, "2026-07-07");
    expect(stats1.todayStatus).toEqual({
      state: "checked_in",
      firstPunch: "2026-07-07T08:50:00Z",
      lastPunch: null,
    });

    const stats2 = calculateEmployeePersonalStats([], 101, "09:00", 15, monthDates, "2026-07-07");
    expect(stats2.todayStatus).toEqual({
      state: "not_scanned",
      firstPunch: null,
      lastPunch: null,
    });
  });

  it("calculates weekly hours correctly across month transition (e.g. July 1st is Wednesday, Monday June 29 & Tuesday June 30 included)", () => {
    const mockLogs: RawBiometricLog[] = [
      { id: 1, employee_id: 101, employee_name: "Alice", log_date: "2026-06-29", log_time: "09:00:00", log_date_time: "2026-06-29T09:00:00Z" },
      { id: 2, employee_id: 101, employee_name: "Alice", log_date: "2026-06-29", log_time: "17:00:00", log_date_time: "2026-06-29T17:00:00Z" },
      { id: 3, employee_id: 101, employee_name: "Alice", log_date: "2026-06-30", log_time: "09:00:00", log_date_time: "2026-06-30T09:00:00Z" },
      { id: 4, employee_id: 101, employee_name: "Alice", log_date: "2026-06-30", log_time: "17:00:00", log_date_time: "2026-06-30T17:00:00Z" },
      { id: 5, employee_id: 101, employee_name: "Alice", log_date: "2026-07-01", log_time: "09:00:00", log_date_time: "2026-07-01T09:00:00Z" },
      { id: 6, employee_id: 101, employee_name: "Alice", log_date: "2026-07-01", log_time: "17:00:00", log_date_time: "2026-07-01T17:00:00Z" },
    ];
    const monthDates = ["2026-07-01", "2026-07-02", "2026-07-03"];
    const stats = calculateEmployeePersonalStats(mockLogs, 101, "09:00", 15, monthDates, "2026-07-01");
    expect(stats.loggedHoursThisWeek).toBe(21);
    expect(stats.presentDaysCount).toBe(1);
  });
});

describe("generateMonthlyCalendarMatrix", () => {
  it("generates calendar days with correct status, weekend flags, and current month flags", () => {
    const mockLogs: RawBiometricLog[] = [
      { id: 1, employee_id: 101, employee_name: "Alice", log_date: "2026-07-06", log_time: "08:50:00", log_date_time: "2026-07-06T08:50:00Z" },
      { id: 2, employee_id: 101, employee_name: "Alice", log_date: "2026-07-06", log_time: "17:00:00", log_date_time: "2026-07-06T17:00:00Z" },
      { id: 3, employee_id: 101, employee_name: "Alice", log_date: "2026-07-07", log_time: "09:30:00", log_date_time: "2026-07-07T09:30:00Z" },
      { id: 4, employee_id: 101, employee_name: "Alice", log_date: "2026-07-07", log_time: "17:00:00", log_date_time: "2026-07-07T17:00:00Z" },
    ];
    // Year 2026, Month 7 (July 2026). todayStr: "2026-07-07"
    const matrix = generateMonthlyCalendarMatrix(mockLogs, 101, 2026, 7, "09:00", 15, "2026-07-07");

    expect(matrix.length).toBeGreaterThanOrEqual(31);

    // Find July 6, 2026
    const july6 = matrix.find((d) => d.date === "2026-07-06");
    expect(july6).toBeDefined();
    expect(july6?.isCurrentMonth).toBe(true);
    expect(july6?.isWeekend).toBe(false);
    expect(july6?.status).toBe("on_time");
    expect(july6?.totalHours).toBe(7.17);

    // Find July 7, 2026
    const july7 = matrix.find((d) => d.date === "2026-07-07");
    expect(july7?.status).toBe("late");
    expect(july7?.lateMins).toBe(30);

    // Find July 8, 2026 (future date > todayStr)
    const july8 = matrix.find((d) => d.date === "2026-07-08");
    expect(july8?.status).toBe("future");

    // Find July 5, 2026 (Sunday -> weekend)
    const july5 = matrix.find((d) => d.date === "2026-07-05");
    expect(july5?.status).toBe("weekend");
    expect(july5?.isWeekend).toBe(true);

    // Find July 1, 2026 (Wednesday, past date before July 6 with no logs -> absent)
    const july1 = matrix.find((d) => d.date === "2026-07-01");
    expect(july1?.status).toBe("absent");
  });

  it("should align grid matrix with Sunday as the first column of the week", () => {
    // July 1, 2026 is a Wednesday (getUTCDay = 3).
    // For Sunday-first calendar, leading padding starts on Sunday June 28, 2026.
    const matrix = generateMonthlyCalendarMatrix([], 101, 2026, 7, "09:00", 15, "2026-07-07");
    expect(matrix[0].date).toBe("2026-06-28"); // Sunday
    expect(matrix[0].isWeekend).toBe(true);
    expect(matrix[3].date).toBe("2026-07-01"); // Wednesday (July 1st)
  });
});


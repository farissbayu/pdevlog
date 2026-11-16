import { describe, expect, it } from "vitest";

import {
  parseDayKey,
  shiftWeekKey,
  weekKeyFor,
  weekRangeFor,
} from "@/client/features/week/week-range";

describe("weekRangeFor", () => {
  it("keeps a Monday as the start of its own week", () => {
    const range = weekRangeFor(parseDayKey("2026-11-09"));
    expect(range).toEqual({ start: "2026-11-09", end: "2026-11-15" });
  });

  it("maps a Sunday to the Monday before it", () => {
    const range = weekRangeFor(parseDayKey("2026-11-15"));
    expect(range).toEqual({ start: "2026-11-09", end: "2026-11-15" });
  });

  it("maps a mid-week day to the same Monday", () => {
    expect(weekRangeFor(parseDayKey("2026-11-12")).start).toBe("2026-11-09");
  });

  it("spans 7 days across a month boundary", () => {
    const range = weekRangeFor(parseDayKey("2026-12-30"));
    expect(range).toEqual({ start: "2026-12-28", end: "2027-01-03" });
  });
});

describe("weekKeyFor and shiftWeekKey", () => {
  it("round-trips a week key through a date", () => {
    const key = "2026-11-09";
    expect(weekKeyFor(parseDayKey(key))).toBe(key);
  });

  it("shifts by whole weeks in both directions", () => {
    expect(shiftWeekKey("2026-11-09", -1)).toBe("2026-11-02");
    expect(shiftWeekKey("2026-11-09", 1)).toBe("2026-11-16");
  });

  it("parses day keys as local midnight, not UTC", () => {
    const date = parseDayKey("2026-11-09");
    expect(date.getDate()).toBe(9);
    expect(date.getMonth()).toBe(10);
  });
});

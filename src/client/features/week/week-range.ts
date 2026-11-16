import { addDays, format, startOfWeek } from "date-fns";

export type WeekRange = { start: string; end: string };

const WEEK_OPTIONS = { weekStartsOn: 1 } as const;

/** Local midnight for a `yyyy-MM-dd` key (avoids the UTC shift of `new Date("...")`). */
export function parseDayKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year!, month! - 1, day!);
}

/** Monday of the week that contains `date`, as a `yyyy-MM-dd` key. */
export function weekKeyFor(date: Date): string {
  return format(startOfWeek(date, WEEK_OPTIONS), "yyyy-MM-dd");
}

/** Monday..Sunday span for the week that contains `date`. */
export function weekRangeFor(date: Date): WeekRange {
  const start = startOfWeek(date, WEEK_OPTIONS);
  return {
    start: format(start, "yyyy-MM-dd"),
    end: format(addDays(start, 6), "yyyy-MM-dd"),
  };
}

/** Shift a week key by whole weeks (negative = earlier). */
export function shiftWeekKey(key: string, weeks: number): string {
  return format(addDays(parseDayKey(key), weeks * 7), "yyyy-MM-dd");
}

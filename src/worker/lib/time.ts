const MS_PER_DAY = 86_400_000;

// tzOffsetMinutes is minutes east of UTC (the client sends -getTimezoneOffset()).
export function dayStartUtc(day: string, tzOffsetMinutes: number): Date {
  return new Date(
    Date.parse(`${day}T00:00:00.000Z`) - tzOffsetMinutes * 60_000,
  );
}

export function dayEndUtc(day: string, tzOffsetMinutes: number): Date {
  return new Date(dayStartUtc(day, tzOffsetMinutes).getTime() + MS_PER_DAY - 1);
}

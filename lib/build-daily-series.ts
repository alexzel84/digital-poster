export function buildDailySeries(
  counts: { day: string; count: number }[],
  days: number,
  now: Date = new Date()
): { label: string; value: number }[] {
  const countsByDay = new Map(counts.map((c) => [c.day, c.count]));
  const series: { label: string; value: number }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - i);
    const dayKey = date.toISOString().slice(0, 10); // YYYY-MM-DD
    const label = date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
    series.push({ label, value: countsByDay.get(dayKey) ?? 0 });
  }

  return series;
}

/**
 * Scheduled playback — pure logic, no I/O, safe to import from the TV player.
 *
 * Model: each screen↔media placement has an optional list of rules.
 *  - No rules  => "default" content. Plays only when no scheduled item is active.
 *  - Rules     => "scheduled" content. Plays only while one of its rules matches;
 *                 while ANY scheduled item is active it takes over from the defaults.
 *  - Nothing active and no defaults => the player shows a dark screen.
 *
 * All times are wall-clock times in the SCREEN's IANA time zone.
 */

export interface WeeklyRule {
  kind: "weekly";
  days: number[]; // 0 = Sunday … 6 = Saturday
  start: string; // "HH:MM" 24h, inclusive
  end: string; // "HH:MM" 24h, exclusive; must be after start (no overnight windows)
  from?: string; // "YYYY-MM-DD", optional first day the rule applies (inclusive)
  until?: string; // "YYYY-MM-DD", optional last day the rule applies (inclusive)
}

export interface DateRule {
  kind: "date";
  date: string; // "YYYY-MM-DD"
  start: string;
  end: string;
}

export type ScheduleRule = WeeklyRule | DateRule;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseTime(value: string): number | null {
  const m = TIME_RE.exec(value);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function isValidDateString(value: string): boolean {
  return DATE_RE.test(value);
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export interface LocalParts {
  date: string; // "YYYY-MM-DD" in the zone
  weekday: number; // 0–6
  minutes: number; // minutes since local midnight
}

/** What wall-clock moment is it in `timeZone`? Falls back to UTC for an invalid zone. */
export function getLocalParts(now: Date, timeZone: string): LocalParts {
  const zone = isValidTimeZone(timeZone) ? timeZone : "UTC";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = Number(get("hour")) % 24;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: WEEKDAY_INDEX[get("weekday")] ?? 0,
    minutes: hour * 60 + Number(get("minute")),
  };
}

function ruleMatches(rule: ScheduleRule, local: LocalParts): boolean {
  const start = parseTime(rule.start);
  const end = parseTime(rule.end);
  if (start === null || end === null || end <= start) return false;
  if (local.minutes < start || local.minutes >= end) return false;

  if (rule.kind === "date") return rule.date === local.date;

  if (!rule.days.includes(local.weekday)) return false;
  if (rule.from && local.date < rule.from) return false;
  if (rule.until && local.date > rule.until) return false;
  return true;
}

export function hasSchedule(rules: ScheduleRule[] | null | undefined): rules is ScheduleRule[] {
  return Array.isArray(rules) && rules.length > 0;
}

export function isScheduleActive(
  rules: ScheduleRule[] | null | undefined,
  now: Date,
  timeZone: string
): boolean {
  if (!hasSchedule(rules)) return false;
  const local = getLocalParts(now, timeZone);
  return rules.some((rule) => ruleMatches(rule, local));
}

/**
 * Which items should play right now?
 *  1. Any scheduled item whose rule matches now  -> only those.
 *  2. Otherwise                                   -> items with no schedule.
 *  3. Otherwise                                   -> [] (dark screen).
 * Order is preserved.
 */
export function selectPlayable<T extends { schedule?: ScheduleRule[] | null }>(
  items: T[],
  now: Date,
  timeZone: string
): T[] {
  const active = items.filter((i) => isScheduleActive(i.schedule, now, timeZone));
  if (active.length > 0) return active;
  return items.filter((i) => !hasSchedule(i.schedule));
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime(value: string): string {
  const minutes = parseTime(value);
  if (minutes === null) return value;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Short human summary of one rule, e.g. "Wed, Fri · 6 PM–7 PM". */
export function describeRule(rule: ScheduleRule): string {
  const time = `${formatTime(rule.start)}–${formatTime(rule.end)}`;
  if (rule.kind === "date") return `${rule.date} · ${time}`;
  const days = [...rule.days].sort((a, b) => a - b).map((d) => DAY_LABELS[d]);
  const range =
    rule.from || rule.until ? ` (${rule.from ?? "…"} → ${rule.until ?? "…"})` : "";
  return `${days.join(", ")} · ${time}${range}`;
}

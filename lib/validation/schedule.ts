import { z } from "zod";
import {
  parseTime,
  isValidDateString,
  isValidTimeZone,
} from "@/lib/schedule/schedule";

const time = z.string().refine((v) => parseTime(v) !== null, "Use HH:MM (24h)");
const date = z.string().refine(isValidDateString, "Use YYYY-MM-DD");

const weeklyRuleSchema = z.object({
  kind: z.literal("weekly"),
  days: z
    .array(z.number().int().min(0).max(6))
    .min(1, "Pick at least one day")
    .max(7),
  start: time,
  end: time,
  from: date.optional(),
  until: date.optional(),
});

const dateRuleSchema = z.object({
  kind: z.literal("date"),
  date,
  start: time,
  end: time,
});

export const scheduleRuleSchema = z
  .discriminatedUnion("kind", [weeklyRuleSchema, dateRuleSchema])
  .refine((r) => (parseTime(r.end) ?? 0) > (parseTime(r.start) ?? 0), {
    message: "End time must be after start time",
  })
  .refine((r) => r.kind !== "weekly" || !r.from || !r.until || r.from <= r.until, {
    message: "“From” date must not be after “until” date",
  });

// Empty array / null both mean "no schedule".
export const updateScheduleSchema = z.object({
  schedule: z.array(scheduleRuleSchema).max(20, "Too many rules").nullable(),
});

export const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine(isValidTimeZone, "Unknown time zone");

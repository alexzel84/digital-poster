"use client";

import { useState } from "react";
import {
  parseTime,
  type ScheduleRule,
} from "@/lib/schedule/schedule";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function todayString(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function validate(rules: ScheduleRule[]): string | null {
  for (const rule of rules) {
    const start = parseTime(rule.start);
    const end = parseTime(rule.end);
    if (start === null || end === null) return "Set a start and end time for every rule.";
    if (end <= start) return "End time must be after start time.";
    if (rule.kind === "weekly" && rule.days.length === 0) return "Pick at least one day.";
    if (rule.kind === "date" && !rule.date) return "Pick a date for every one-time rule.";
    if (rule.kind === "weekly" && rule.from && rule.until && rule.from > rule.until) {
      return "“From” date must not be after “until” date.";
    }
  }
  return null;
}

export function ScheduleEditor({
  initial,
  timezone,
  saving,
  error,
  onSave,
  onCancel,
}: {
  initial: ScheduleRule[] | null;
  timezone: string;
  saving: boolean;
  error: boolean;
  onSave: (rules: ScheduleRule[] | null) => void;
  onCancel: () => void;
}) {
  const [rules, setRules] = useState<ScheduleRule[]>(
    initial && initial.length > 0
      ? initial
      : [{ kind: "weekly", days: [], start: "18:00", end: "19:00" }]
  );
  const [localError, setLocalError] = useState<string | null>(null);

  function update(index: number, patch: Partial<ScheduleRule>) {
    setRules((prev) =>
      prev.map((r, i) => (i === index ? ({ ...r, ...patch } as ScheduleRule) : r))
    );
  }

  function toggleDay(index: number, day: number) {
    setRules((prev) =>
      prev.map((r, i) => {
        if (i !== index || r.kind !== "weekly") return r;
        const days = r.days.includes(day) ? r.days.filter((d) => d !== day) : [...r.days, day];
        return { ...r, days };
      })
    );
  }

  function handleSave() {
    const message = validate(rules);
    if (message) {
      setLocalError(message);
      return;
    }
    setLocalError(null);
    onSave(rules);
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3 text-xs">
      <p className="text-muted-foreground">
        Plays only during these times, in <span className="font-medium">{timezone}</span>. Outside
        them the screen shows your items without a schedule (or goes dark if there are none).
      </p>

      {timezone === "UTC" && (
        <p className="text-amber-700">
          This screen&apos;s time zone is UTC. If that&apos;s not where the TV is, set the right
          time zone in the screen details at the top of this page first.
        </p>
      )}

      {rules.map((rule, index) => (
        <div key={index} className="space-y-2 rounded-md border border-border bg-background p-2">
          <div className="flex items-center justify-between gap-2">
            <select
              value={rule.kind}
              onChange={(e) =>
                setRules((prev) =>
                  prev.map((r, i) =>
                    i !== index
                      ? r
                      : e.target.value === "date"
                        ? { kind: "date", date: todayString(), start: r.start, end: r.end }
                        : { kind: "weekly", days: [], start: r.start, end: r.end }
                  )
                )
              }
              className="rounded border border-border bg-background px-1.5 py-1"
            >
              <option value="weekly">Every week</option>
              <option value="date">One date</option>
            </select>
            <button
              onClick={() => setRules((prev) => prev.filter((_, i) => i !== index))}
              className="text-red-600 underline"
            >
              Remove
            </button>
          </div>

          {rule.kind === "weekly" ? (
            <div className="flex flex-wrap gap-1">
              {DAYS.map((label, day) => {
                const on = rule.days.includes(day);
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleDay(index, day)}
                    className={`h-8 min-w-[2.5rem] rounded-full border px-2 ${
                      on
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ) : (
            <input
              type="date"
              value={rule.date}
              onChange={(e) => update(index, { date: e.target.value } as Partial<ScheduleRule>)}
              className="rounded border border-border px-2 py-1"
            />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="time"
              value={rule.start}
              onChange={(e) => update(index, { start: e.target.value })}
              className="rounded border border-border px-2 py-1"
            />
            <span className="text-muted-foreground">to</span>
            <input
              type="time"
              value={rule.end}
              onChange={(e) => update(index, { end: e.target.value })}
              className="rounded border border-border px-2 py-1"
            />
          </div>

          {rule.kind === "weekly" && (
            <details className="text-muted-foreground">
              <summary className="cursor-pointer">Limit to a date range (optional)</summary>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span>from</span>
                <input
                  type="date"
                  value={rule.from ?? ""}
                  onChange={(e) =>
                    update(index, { from: e.target.value || undefined } as Partial<ScheduleRule>)
                  }
                  className="rounded border border-border px-2 py-1"
                />
                <span>until</span>
                <input
                  type="date"
                  value={rule.until ?? ""}
                  onChange={(e) =>
                    update(index, { until: e.target.value || undefined } as Partial<ScheduleRule>)
                  }
                  className="rounded border border-border px-2 py-1"
                />
              </div>
            </details>
          )}
        </div>
      ))}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() =>
            setRules((prev) => [
              ...prev,
              { kind: "weekly", days: [], start: "18:00", end: "19:00" },
            ])
          }
          className="underline"
        >
          + Add another time
        </button>
      </div>

      {(localError || error) && (
        <p className="text-red-600">{localError ?? "Couldn't save the schedule — please try again."}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="font-medium underline">
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={() => onSave(null)} disabled={saving} className="text-muted-foreground underline">
          Clear schedule (play by default)
        </button>
        <button onClick={onCancel} className="text-muted-foreground">
          Cancel
        </button>
      </div>
    </div>
  );
}

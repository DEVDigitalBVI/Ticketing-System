import { z } from "zod";

export const reportFilterSchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
  timezone: z.string().min(1).max(100),
  propertyId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  source: z.string().trim().min(1).max(40).optional(),
});

function localParts(value: Date, timezone: string) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>;
}

function utcForLocalDate(date: string, timezone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const target = Date.UTC(year!, month! - 1, day!, 0, 0, 0);
  let candidate = target;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = localParts(new Date(candidate), timezone);
    candidate +=
      target -
      Date.UTC(
        actual.year!,
        actual.month! - 1,
        actual.day!,
        actual.hour!,
        actual.minute!,
        actual.second!,
      );
  }
  return new Date(candidate);
}

function nextDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + 1)).toISOString().slice(0, 10);
}

export function parseReportRange(from: string, to: string, timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    throw new Error("Invalid reporting time zone.");
  }
  const start = utcForLocalDate(from, timezone);
  const end = utcForLocalDate(nextDate(to), timezone);
  if (end <= start) throw new Error("The report end date must be on or after the start date.");
  if (end.getTime() - start.getTime() > 367 * 86_400_000)
    throw new Error("Reports are limited to 366 days.");
  return { start, end, timezone };
}

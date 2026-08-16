import {
  addDays,
  addMinutes,
  format,
  parse,
  startOfDay,
} from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import type { Appointment, BreakPeriod, DailyHours, Service } from "@/types/database";

function parseHm(baseDate: Date, hm: string, timeZone: string): Date {
  const local = toZonedTime(baseDate, timeZone);
  const day = startOfDay(local);
  const parsed = parse(hm, "HH:mm", day);
  return fromZonedTime(parsed, timeZone);
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function generateOpenSlots(params: {
  date: Date;
  timeZone: string;
  workingDays: number[];
  dailyHours: DailyHours;
  breaks: BreakPeriod[];
  bufferMinutes: number;
  service: Pick<Service, "duration_minutes">;
  appointments: Pick<Appointment, "starts_at" | "ends_at" | "status">[];
  now?: Date;
}): string[] {
  const {
    date,
    timeZone,
    workingDays,
    dailyHours,
    breaks,
    bufferMinutes,
    service,
    appointments,
    now = new Date(),
  } = params;

  const zoned = toZonedTime(date, timeZone);
  const weekday = zoned.getDay();
  if (!workingDays.includes(weekday)) return [];

  const dayStart = parseHm(date, dailyHours.start, timeZone);
  const dayEnd = parseHm(date, dailyHours.end, timeZone);
  if (!(dayStart < dayEnd)) return [];

  const breakRanges = (breaks ?? []).map((b) => ({
    start: parseHm(date, b.start, timeZone),
    end: parseHm(date, b.end, timeZone),
  }));

  const busy = appointments
    .filter((a) => a.status !== "canceled")
    .map((a) => ({
      start: addMinutes(new Date(a.starts_at), -bufferMinutes),
      end: addMinutes(new Date(a.ends_at), bufferMinutes),
    }));

  const duration = service.duration_minutes;
  const step = 15;
  const slots: string[] = [];
  let cursor = dayStart;

  while (addMinutes(cursor, duration) <= dayEnd) {
    const slotEnd = addMinutes(cursor, duration);
    const inBreak = breakRanges.some((b) => overlaps(cursor, slotEnd, b.start, b.end));
    const conflict = busy.some((b) => overlaps(cursor, slotEnd, b.start, b.end));
    if (!inBreak && !conflict && cursor >= now) {
      slots.push(cursor.toISOString());
    }
    cursor = addMinutes(cursor, step);
  }

  return slots;
}

export function nextDays(count: number, from = new Date()): Date[] {
  return Array.from({ length: count }, (_, i) => addDays(startOfDay(from), i));
}

export function formatInZone(
  iso: string,
  timeZone: string,
  pattern = "yyyy-MM-dd HH:mm"
): string {
  return format(toZonedTime(new Date(iso), timeZone), pattern);
}

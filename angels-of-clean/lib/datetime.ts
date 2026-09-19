// Angels of Clean operates only in Syracuse, NY. Every booking time means
// America/New_York wall-clock time, regardless of where the server or the
// viewer is. These helpers are built on Intl (which knows named-zone offsets
// and DST) so they behave identically no matter what TZ the process runs in —
// e.g. a Vercel server in UTC or an admin viewing from another zone.

export const NY_TIME_ZONE = "America/New_York";

// Offset in milliseconds east of UTC that America/New_York is at for a given
// UTC instant (negative for NY: -4h in EDT, -5h in EST). Derived by formatting
// the instant in NY and comparing the wall-clock reading against UTC.
function nyOffsetMs(utcMs: number): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: NY_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(new Date(utcMs))) parts[p.type] = p.value;
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asIfUtc - utcMs;
}

/**
 * Build the UTC instant for a New York wall-clock date + time, correct across
 * DST. `dateStr` is "YYYY-MM-DD", `timeStr` is "HH:MM:SS" (or "HH:MM").
 *
 * The wall clock is first treated as if it were UTC to get an approximate
 * instant, then shifted by NY's offset at that instant. The offset is
 * re-checked at the shifted instant to stay correct right at a DST boundary.
 */
export function nyWallClockToInstant(dateStr: string, timeStr: string): Date {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi, s] = timeStr.split(":").map(Number);
  const wallAsUtc = Date.UTC(y, mo - 1, d, h, mi, s || 0);
  const offset = nyOffsetMs(wallAsUtc);
  let ts = wallAsUtc - offset;
  const offset2 = nyOffsetMs(ts);
  if (offset2 !== offset) ts = wallAsUtc - offset2;
  return new Date(ts);
}

// Wall-clock parts of an instant, read in America/New_York.
function nyPartsMap(
  instant: Date,
  opts: Intl.DateTimeFormatOptions,
): Record<string, string> {
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone: NY_TIME_ZONE, ...opts });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(instant)) map[p.type] = p.value;
  return map;
}

/** "YYYY-MM-DD" for the given instant (default: now) in New York. */
export function nyDateStr(instant: Date | string = new Date()): string {
  const p = nyPartsMap(new Date(instant), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return `${p.year}-${p.month}-${p.day}`;
}

/** Today's date in New York, as "YYYY-MM-DD". */
export function nyTodayStr(): string {
  return nyDateStr();
}

/**
 * New York wall-clock time as an offset-less ISO string
 * ("YYYY-MM-DDTHH:MM:SS"). Used to feed FullCalendar in UTC-coercion mode so a
 * job always lands on the grid at its New York clock time.
 */
export function nyWallClockISO(instant: Date | string = new Date()): string {
  const p = nyPartsMap(new Date(instant), {
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}

/** Format an instant in New York with arbitrary Intl options. */
export function formatNy(
  instant: Date | string,
  opts: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: NY_TIME_ZONE, ...opts }).format(
    new Date(instant),
  );
}

/** "8:00 AM" — New York time with AM/PM. */
export function formatNyTime(instant: Date | string): string {
  return formatNy(instant, { hour: "numeric", minute: "2-digit", hour12: true });
}

/** "8:00 AM – 12:00 PM" — New York time range with AM/PM. */
export function formatNyTimeRange(
  start: Date | string,
  end: Date | string,
): string {
  return `${formatNyTime(start)} – ${formatNyTime(end)}`;
}

/** "Aug 1, 8:00 AM" — compact date + time in New York, for logs/timelines. */
export function formatNyDateTime(instant: Date | string): string {
  return formatNy(instant, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

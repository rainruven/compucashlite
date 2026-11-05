// Business day handling in the restaurant's time zone (Estonia).
export const TIME_ZONE = "Europe/Tallinn";

function tzOffsetMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** Returns [start, end) UTC instants of the given YYYY-MM-DD day in Tallinn time. */
export function dayBounds(date: string): [Date, Date] {
  const [y, m, d] = date.split("-").map(Number);
  const startGuess = new Date(Date.UTC(y, m - 1, d));
  const endGuess = new Date(Date.UTC(y, m - 1, d + 1));
  const start = new Date(startGuess.getTime() - tzOffsetMinutes(startGuess) * 60000);
  const end = new Date(endGuess.getTime() - tzOffsetMinutes(endGuess) * 60000);
  return [start, end];
}

/** Hour (0-23) of the given instant in Tallinn time. */
export function localHour(date: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "2-digit", hourCycle: "h23" }).format(date),
  );
}

/** Today's date as YYYY-MM-DD in Tallinn time. */
export function todayLocal(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());
}

export function formatDateTime(iso: string | Date): string {
  return new Intl.DateTimeFormat("et-EE", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatTime(iso: string | Date): string {
  return new Intl.DateTimeFormat("et-EE", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );
}

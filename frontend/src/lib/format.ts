const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Split an API time "YYYY-MM-DDTHH:MM[:SS]" into its parts; no timezone shift. */
function parts(iso: string) {
  const [date = "", time = "00:00"] = iso.split("T");
  const [year, month, day] = date.split("-");
  return { year, month, day, clock: time.slice(0, 5) };
}

/** Format as "Mon 14 Sep". */
export function formatDay(iso: string): string {
  const { year, month, day } = parts(iso);
  const weekday = new Date(Number(year), Number(month) - 1, Number(day)).getDay();
  return `${WEEKDAYS[weekday]} ${Number(day)} ${MONTHS[Number(month) - 1]}`;
}

/** Format as "06:15". */
export function formatClock(iso: string): string {
  return parts(iso).clock;
}

/** Format as "14/09 06:15". */
export function formatShort(iso: string): string {
  const { month, day, clock } = parts(iso);
  return `${day}/${month} ${clock}`;
}

/** Format as a datetime-local input value, "2026-09-14T06:15". */
export function toDateTimeLocal(iso: string): string {
  return iso.slice(0, 16);
}

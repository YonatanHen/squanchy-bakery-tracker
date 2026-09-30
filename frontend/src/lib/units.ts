export type Metric = "C" | "F";

/** Convert a value measured in `metric` to Celsius. */
export function toCelsius(value: number, metric: Metric): number {
  return metric === "F" ? ((value - 32) * 5) / 9 : value;
}

/** Convert a Celsius value to `metric`. */
export function fromCelsius(value: number, metric: Metric): number {
  return metric === "F" ? (value * 9) / 5 + 32 : value;
}

/** Convert a typed temperature from one unit to another, one decimal at most; other text is kept. */
export function convertTypedTemp(text: string, from: Metric, to: Metric): string {
  const value = Number(text);
  if (text.trim() === "" || Number.isNaN(value)) return text;
  return String(Number(fromCelsius(toCelsius(value, from), to).toFixed(1)));
}

/** Format a reading in `displayUnit` with one decimal; null (ERR) shows as "—"; compact drops the unit letter. */
export function formatTemp(
  value: number | null,
  metric: Metric,
  displayUnit: Metric,
  { compact = false }: { compact?: boolean } = {},
): string {
  if (value === null) return "—";
  const shown = fromCelsius(toCelsius(value, metric), displayUnit).toFixed(1);
  return compact ? `${shown}°` : `${shown} °${displayUnit}`;
}

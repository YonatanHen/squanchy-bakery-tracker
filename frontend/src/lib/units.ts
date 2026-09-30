export type Metric = "C" | "F";

/** Convert a value measured in `metric` to Celsius. */
export function toCelsius(value: number, metric: Metric): number {
  return metric === "F" ? ((value - 32) * 5) / 9 : value;
}

/** Convert a Celsius value to `metric`. */
export function fromCelsius(value: number, metric: Metric): number {
  return metric === "F" ? (value * 9) / 5 + 32 : value;
}

/** Format a reading in `displayUnit` with one decimal; null (ERR) shows as "—". */
export function formatTemp(value: number | null, metric: Metric, displayUnit: Metric): string {
  if (value === null) return "—";
  const shown = fromCelsius(toCelsius(value, metric), displayUnit);
  return `${shown.toFixed(1)} °${displayUnit}`;
}

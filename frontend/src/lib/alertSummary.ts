import type { AlertLevel } from "./endpoints";

export interface AlertSummary {
  level: AlertLevel;
  tone: "urgent" | "light";
  text: string;
}

/** Summarize a reading's alert levels as "2 alerts" in the most severe level; null when none. */
export function summarizeAlerts(levels: AlertLevel[]): AlertSummary | null {
  if (levels.length === 0) return null;
  const urgent = levels.includes("URGENT");
  return {
    level: urgent ? "URGENT" : "NON_URGENT",
    tone: urgent ? "urgent" : "light",
    text: `${levels.length} ${levels.length === 1 ? "alert" : "alerts"}`,
  };
}

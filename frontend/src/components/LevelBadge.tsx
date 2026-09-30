import type { ReactNode } from "react";
import type { AlertLevel } from "../lib/endpoints";
import styles from "../styles/components/LevelBadge.module.css";

export type BadgeLevel = AlertLevel | "ERR";

const LABELS: Record<BadgeLevel, string> = { URGENT: "Urgent", NON_URGENT: "Non-urgent", ERR: "ERR" };

/** Render a small badge in the style of an alert level, or the ERR reading status. */
export function LevelBadge({ level, children }: { level: BadgeLevel; children?: ReactNode }) {
  return (
    <span data-level={level} className={`${styles.badge} ${styles[level]}`}>
      {children ?? LABELS[level]}
    </span>
  );
}

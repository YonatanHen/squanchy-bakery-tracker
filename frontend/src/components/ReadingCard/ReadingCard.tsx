import { summarizeAlerts } from "../../lib/alertSummary";
import type { AlertLevel, Reading } from "../../lib/endpoints";
import { formatClock, formatDay } from "../../lib/format";
import { formatTemp, type Metric } from "../../lib/units";
import { Card } from "../Card/Card";
import { EditIcon } from "../icons/icons";
import { LevelBadge } from "../LevelBadge/LevelBadge";
import styles from "./ReadingCard.module.css";

interface ReadingCardProps {
  reading: Reading;
  unit: Metric;
  alerts: AlertLevel[];
  onEdit: (reading: Reading) => void;
}

/** One reading on the phone list: when, where, temperature, alert or ERR badge, and Edit. */
export function ReadingCard({ reading, unit, alerts, onEdit }: ReadingCardProps) {
  const summary = summarizeAlerts(alerts);
  return (
    <Card tone={summary?.tone === "urgent" ? "urgent" : "default"} className={styles.card}>
      <div className={styles.info}>
        <span className={styles.when}>{`${formatDay(reading.time)} · ${formatClock(reading.time)}`}</span>
        <span className={styles.where}>
          {`${reading.branch} · ${reading.fridge} · `}
          <span className={styles.mono}>{reading.logger_id}</span>
        </span>
        {reading.status === "ERR" && <LevelBadge level="ERR" />}
        {summary && <LevelBadge level={summary.level}>{summary.text}</LevelBadge>}
      </div>
      <span className={summary?.tone === "urgent" ? `${styles.temp} ${styles.urgentTemp}` : styles.temp}>
        {formatTemp(reading.temp, reading.metric, unit, { compact: true })}
      </span>
      <button type="button" aria-label="Edit reading" className={styles.edit} onClick={() => onEdit(reading)}>
        <EditIcon />
      </button>
    </Card>
  );
}

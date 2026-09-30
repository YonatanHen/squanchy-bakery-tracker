import type { Alert } from "../../lib/endpoints";
import { formatClock, formatDay, formatShort } from "../../lib/format";
import { Card } from "../Card/Card";
import { LevelBadge } from "../LevelBadge/LevelBadge";
import styles from "./AlertCard.module.css";

/** One alert on the phone list: level, what happened, and where and when. */
export function AlertCard({ alert }: { alert: Alert }) {
  const urgent = alert.level === "URGENT";
  return (
    <Card tone={urgent ? "urgent" : "light"} className={styles.card}>
      <LevelBadge level={alert.level} />
      <strong className={urgent ? styles.description : `${styles.description} ${styles.light}`}>
        {alert.description}
      </strong>
      <span className={styles.meta}>
        {`${alert.branch} · ${alert.fridge} · ${formatDay(alert.time)} ${formatClock(alert.time)}`}
      </span>
      {alert.archived_at && <span className={styles.meta}>{`Archived ${formatShort(alert.archived_at)}`}</span>}
    </Card>
  );
}

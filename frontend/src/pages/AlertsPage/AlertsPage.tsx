import { useEffect, useState } from "react";
import { AlertCard } from "../../components/AlertCard/AlertCard";
import type { Column } from "../../components/DataTable/DataTable";
import { EmptyState } from "../../components/EmptyState/EmptyState";
import { LevelBadge } from "../../components/LevelBadge/LevelBadge";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import { ResponsiveList } from "../../components/ResponsiveList/ResponsiveList";
import { listAlerts, type Alert, type Page } from "../../lib/endpoints";
import { formatShort } from "../../lib/format";
import { formatTemp } from "../../lib/units";
import styles from "./AlertsPage.module.css";

// The reading is shown in its logger's own unit
const COLUMNS: Column<Alert>[] = [
  { key: "level", header: "Level", cell: (a) => <LevelBadge level={a.level} /> },
  {
    key: "what",
    header: "What happened",
    cell: (a) => (a.level === "URGENT" ? <strong>{a.description}</strong> : a.description),
  },
  { key: "reading", header: "Reading", cell: (a) => formatTemp(a.temp, a.metric, a.metric), mono: true },
  { key: "fridge", header: "Fridge", cell: (a) => a.fridge },
  { key: "branch", header: "Branch", cell: (a) => a.branch },
  { key: "time", header: "Time", cell: (a) => formatShort(a.time), mono: true },
];

/** Alerts screen: active or archived alerts by level, cards on phones and a table on desktop. */
export function AlertsPage() {
  const [page, setPage] = useState<Page<Alert> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    listAlerts({ archived: false, offset: 0 })
      .then((result) => active && (setPage(result), setError("")))
      .catch(() => active && setError("Could not load the alerts. Try again."));
    return () => {
      active = false;
    };
  }, []);

  const items = page?.items ?? [];

  return (
    <section className={styles.page}>
      <PageHeader title="Alerts" />
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {page && items.length === 0 && <EmptyState message="No active alerts." />}
      {items.length > 0 && (
        <ResponsiveList
          label="Alerts"
          rows={items}
          rowKey={(a) => a.id}
          renderCard={(a) => <AlertCard alert={a} />}
          columns={COLUMNS}
          rowTone={(a) => (a.level === "URGENT" ? "urgent" : "light")}
        />
      )}
    </section>
  );
}

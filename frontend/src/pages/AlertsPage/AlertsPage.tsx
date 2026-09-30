import { useEffect, useState } from "react";
import { AlertCard } from "../../components/AlertCard/AlertCard";
import type { Column } from "../../components/DataTable/DataTable";
import { EmptyState } from "../../components/EmptyState/EmptyState";
import { Field } from "../../components/Field/Field";
import { LevelBadge } from "../../components/LevelBadge/LevelBadge";
import { PageHeader } from "../../components/PageHeader/PageHeader";
import { Pager } from "../../components/Pager/Pager";
import { ResponsiveList } from "../../components/ResponsiveList/ResponsiveList";
import { SegmentedToggle } from "../../components/SegmentedToggle/SegmentedToggle";
import { Select } from "../../components/Select/Select";
import { listAlerts, type Alert, type AlertLevel, type Page } from "../../lib/endpoints";
import { formatShort } from "../../lib/format";
import { formatTemp } from "../../lib/units";
import styles from "./AlertsPage.module.css";

const LEVELS = [
  { value: "", label: "All" },
  { value: "URGENT", label: "Urgent" },
  { value: "NON_URGENT", label: "Non-urgent" },
];

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
  const [archived, setArchived] = useState<boolean>(false);
  const [level, setLevel] = useState<AlertLevel | "">("");
  const [offset, setOffset] = useState<number>(0);
  const [loaded, setLoaded] = useState<{ page: Page<Alert>; archived: boolean } | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let active = true;
    listAlerts({ archived, level, offset })
      .then((result) => active && (setLoaded({ page: result, archived }), setError("")))
      .catch(() => active && setError("Could not load the alerts. Try again."));
    return () => {
      active = false;
    };
  }, [archived, level, offset]);

  const page = loaded?.page ?? null;
  const items = page?.items ?? [];
  // Count only on the list the numbers belong to
  const count = (forArchived: boolean) => (loaded?.archived === forArchived && page ? ` (${page.total})` : "");
  const lists = [
    { value: "active", label: `Active${archived ? "" : count(false)}` },
    { value: "archived", label: `Archived${archived ? count(true) : ""}` },
  ] as const;

  return (
    <section className={styles.page}>
      <PageHeader title="Alerts">
        <Field label="Level">
          {(control) => (
            <Select
              {...control}
              options={LEVELS}
              value={level}
              onChange={(value) => {
                setLevel(value as AlertLevel | "");
                setOffset(0);
              }}
            />
          )}
        </Field>
        <SegmentedToggle
          label="Alert list"
          options={lists}
          value={archived ? "archived" : "active"}
          onChange={(value) => {
            setArchived(value === "archived");
            setOffset(0);
          }}
        />
      </PageHeader>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {page && items.length === 0 && <EmptyState message={archived ? "No archived alerts." : "No active alerts."} />}
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
      {page && items.length > 0 && (
        <Pager offset={page.offset} limit={page.limit} count={items.length} total={page.total} onPage={setOffset} />
      )}
    </section>
  );
}

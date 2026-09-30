import { useEffect, useState } from "react";
import { Button } from "../../components/Button/Button";
import { DataTable, type Column } from "../../components/DataTable/DataTable";
import { EmptyState } from "../../components/EmptyState/EmptyState";
import { LevelBadge } from "../../components/LevelBadge/LevelBadge";
import { ReadingCard } from "../../components/ReadingCard/ReadingCard";
import { SegmentedToggle } from "../../components/SegmentedToggle/SegmentedToggle";
import { listReadings, type Page, type Reading, type ReadingFilters } from "../../lib/endpoints";
import { formatShort } from "../../lib/format";
import { formatTemp, type Metric } from "../../lib/units";
import styles from "./ReadingsPage.module.css";

const UNITS = [
  { value: "C", label: "°C" },
  { value: "F", label: "°F" },
] as const;

/** Build the desktop table columns for the selected unit. */
function columns(unit: Metric, onEdit: (reading: Reading) => void): Column<Reading>[] {
  return [
    { key: "time", header: "Time", cell: (r) => formatShort(r.time), mono: true },
    { key: "temp", header: "Temperature", cell: (r) => formatTemp(r.temp, r.metric, unit), mono: true },
    { key: "fridge", header: "Fridge", cell: (r) => r.fridge },
    { key: "branch", header: "Branch", cell: (r) => r.branch },
    { key: "logger", header: "Logger", cell: (r) => r.logger_id, mono: true },
    { key: "status", header: "Status", cell: (r) => (r.status === "ERR" ? <LevelBadge level="ERR" /> : "OK") },
    {
      key: "actions",
      header: "Actions",
      hideHeader: true,
      cell: (r) => (
        <Button variant="link" onClick={() => onEdit(r)}>
          Edit
        </Button>
      ),
    },
  ];
}

/** Readings screen: filters, °C/°F, cards on phones and a table on desktop, with paging. */
export function ReadingsPage() {
  const [unit, setUnit] = useState<Metric>("C");
  const [filters] = useState<ReadingFilters>({});
  const [offset] = useState(0);
  const [page, setPage] = useState<Page<Reading> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    listReadings(filters, unit, offset)
      .then((result) => active && (setPage(result), setError("")))
      .catch(() => active && setError("Could not load the readings. Try again."));
    return () => {
      active = false;
    };
  }, [filters, unit, offset]);

  const items = page?.items ?? [];
  const onEdit = () => {};

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Readings</h1>
        <SegmentedToggle label="Unit" options={UNITS} value={unit} onChange={setUnit} />
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {page && items.length === 0 && <EmptyState message="No readings match these filters." />}
      {items.length > 0 && (
        <>
          <ul aria-label="Readings" className={styles.cards}>
            {items.map((reading) => (
              <li key={reading.id}>
                <ReadingCard reading={reading} unit={unit} alerts={[]} onEdit={onEdit} />
              </li>
            ))}
          </ul>
          <div className={styles.table}>
            <DataTable label="Readings" columns={columns(unit, onEdit)} rows={items} rowKey={(r) => r.id} />
          </div>
        </>
      )}
    </section>
  );
}

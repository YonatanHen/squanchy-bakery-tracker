import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/Button/Button";
import { DataTable, type Column } from "../../components/DataTable/DataTable";
import { EditReadingDialog } from "../../components/EditReadingDialog/EditReadingDialog";
import { EmptyState } from "../../components/EmptyState/EmptyState";
import { LevelBadge } from "../../components/LevelBadge/LevelBadge";
import { Pager } from "../../components/Pager/Pager";
import { ReadingCard } from "../../components/ReadingCard/ReadingCard";
import { ReadingFilters } from "../../components/ReadingFilters/ReadingFilters";
import { SegmentedToggle } from "../../components/SegmentedToggle/SegmentedToggle";
import { summarizeAlerts } from "../../lib/alertSummary";
import { ApiError } from "../../lib/api";
import {
  listAlerts,
  listBranches,
  listReadings,
  type AlertLevel,
  type Branch,
  type Page,
  type Reading,
  type ReadingFilters as Filters,
} from "../../lib/endpoints";
import { formatShort } from "../../lib/format";
import { convertTypedTemp, formatTemp, type Metric } from "../../lib/units";
import styles from "./ReadingsPage.module.css";

const UNITS = [
  { value: "C", label: "°C" },
  { value: "F", label: "°F" },
] as const;

// The API's largest page; alerts of one readings page rarely come close
const ALERTS_LIMIT = 200;

type AlertLevels = Record<number, AlertLevel[]>;

/** Get the alert levels of each reading on the page, from the alerts of the page's time span. */
async function loadAlertLevels(items: Reading[], filters: Filters): Promise<AlertLevels> {
  if (items.length === 0) return {};
  const alerts = await listAlerts({
    archived: false,
    branch: filters.branch,
    fridge: filters.fridge,
    dateFrom: items[0].time,
    dateTo: items[items.length - 1].time,
    limit: ALERTS_LIMIT,
  });
  const levels: AlertLevels = {};
  for (const alert of alerts?.items ?? []) (levels[alert.reading_id] ??= []).push(alert.level);
  return levels;
}

/** Show the ERR badge, the alert count badge, or OK. */
function statusCell(reading: Reading, levels: AlertLevel[]) {
  const summary = summarizeAlerts(levels);
  if (reading.status === "ERR") return <LevelBadge level="ERR" />;
  return summary ? <LevelBadge level={summary.level}>{summary.text}</LevelBadge> : "OK";
}

/** Build the desktop table columns for the selected unit. */
function columns(unit: Metric, alertLevels: AlertLevels, onEdit: (reading: Reading) => void): Column<Reading>[] {
  return [
    { key: "time", header: "Time", cell: (r) => formatShort(r.time), mono: true },
    { key: "temp", header: "Temperature", cell: (r) => formatTemp(r.temp, r.metric, unit), mono: true },
    { key: "fridge", header: "Fridge", cell: (r) => r.fridge },
    { key: "branch", header: "Branch", cell: (r) => r.branch },
    { key: "logger", header: "Logger", cell: (r) => r.logger_id, mono: true },
    { key: "status", header: "Status", cell: (r) => statusCell(r, alertLevels[r.id] ?? []) },
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
  const [filters, setFilters] = useState<Filters>({});
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<Page<Reading> | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [alertLevels, setAlertLevels] = useState<AlertLevels>({});
  const [editing, setEditing] = useState<Reading | null>(null);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    listBranches()
      .then((result) => Array.isArray(result) && setBranches(result))
      .catch(() => setBranches([]));
  }, []);

  useEffect(() => {
    let active = true;
    listReadings(filters, unit, offset)
      .then((result) => {
        if (!active) return;
        setPage(result);
        setError("");
        setFieldErrors({});
        setAlertLevels({});
        loadAlertLevels(result?.items ?? [], filters)
          .then((levels) => active && setAlertLevels(levels))
          .catch(() => active && setAlertLevels({}));
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError && err.fieldErrors.length > 0) {
          setFieldErrors(Object.fromEntries(err.fieldErrors.map((e) => [e.field, e.message])));
        } else {
          setError("Could not load the readings. Try again.");
        }
      });
    return () => {
      active = false;
    };
  }, [filters, unit, offset, reloads]);

  const items = page?.items ?? [];
  const onEdit = (reading: Reading) => setEditing(reading);
  const onSaved = () => {
    setEditing(null);
    setReloads((n) => n + 1);
  };

  const applyFilters = (next: Filters) => {
    setFilters(next);
    setOffset(0);
  };

  // Keep the temperature range's meaning when the unit changes
  const changeUnit = (next: Metric) => {
    setFilters((f) => ({
      ...f,
      tempMin: f.tempMin && convertTypedTemp(f.tempMin, unit, next),
      tempMax: f.tempMax && convertTypedTemp(f.tempMax, unit, next),
    }));
    setUnit(next);
  };

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Readings</h1>
        <div className={styles.actions}>
          <Link to="/readings/new" className={`${styles.addLink} ${styles.desktopOnly}`}>
            + Add a reading
          </Link>
          <SegmentedToggle label="Unit" options={UNITS} value={unit} onChange={changeUnit} />
        </div>
      </div>
      <ReadingFilters branches={branches} unit={unit} value={filters} errors={fieldErrors} onApply={applyFilters} />
      {page && (
        <p className={styles.summary}>
          {`${page.total} ${page.total === 1 ? "reading" : "readings"}${filters.branch ? ` · ${filters.branch}` : ""}`}
        </p>
      )}
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
                <ReadingCard reading={reading} unit={unit} alerts={alertLevels[reading.id] ?? []} onEdit={onEdit} />
              </li>
            ))}
          </ul>
          <div className={styles.table}>
            <DataTable
              label="Readings"
              columns={columns(unit, alertLevels, onEdit)}
              rows={items}
              rowKey={(r) => r.id}
              rowTone={(r) => summarizeAlerts(alertLevels[r.id] ?? [])?.tone ?? "default"}
            />
          </div>
        </>
      )}
      <div className={styles.footer}>
        {page && items.length > 0 && (
          <div className={styles.pager}>
            <Pager offset={page.offset} limit={page.limit} count={items.length} total={page.total} onPage={setOffset} />
          </div>
        )}
        <Link to="/readings/new" className={`${styles.addLink} ${styles.phoneOnly}`}>
          + Add a reading
        </Link>
      </div>
      {editing && (
        <EditReadingDialog key={editing.id} reading={editing} onClose={() => setEditing(null)} onSaved={onSaved} />
      )}
    </section>
  );
}

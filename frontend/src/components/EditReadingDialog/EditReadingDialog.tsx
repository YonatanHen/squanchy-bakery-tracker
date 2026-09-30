import { useState } from "react";
import { ApiError } from "../../lib/api";
import { deleteReading, updateReading, type Branch, type Reading, type ReadingChanges } from "../../lib/endpoints";
import { formatShort, toDateTimeLocal } from "../../lib/format";
import { formatTemp, type Metric } from "../../lib/units";
import { Button } from "../Button/Button";
import { DateTimeField } from "../DateTimeField/DateTimeField";
import { Dialog } from "../Dialog/Dialog";
import { Field } from "../Field/Field";
import { SegmentedToggle } from "../SegmentedToggle/SegmentedToggle";
import { Select, type SelectOption } from "../Select/Select";
import { TemperatureField } from "../TemperatureField/TemperatureField";
import styles from "./EditReadingDialog.module.css";

interface EditReadingDialogProps {
  reading: Reading;
  branches: Branch[];
  onClose: () => void;
  onSaved: () => void;
}

type Mode = "edit" | "confirm" | "delete";

const UNITS = [
  { value: "C", label: "°C" },
  { value: "F", label: "°F" },
] as const;

/** Show a typed temperature the way the list shows it: "4.4 °C", or ERR. */
function tempLabel(text: string, metric: Metric): string {
  if (text.trim().toUpperCase() === "ERR") return "ERR";
  const value = Number(text);
  return text.trim() === "" || Number.isNaN(value) ? text : formatTemp(value, metric, metric);
}

/** Map each branch to its fridges that have a logger (value: logger id); the reading's own place is always included. */
function placeOptions(branches: Branch[], reading: Reading): Map<string, SelectOption[]> {
  const places = new Map<string, SelectOption[]>();
  for (const branch of branches) {
    const fridges = branch.fridges.flatMap((f) => (f.logger_id ? [{ value: f.logger_id, label: f.name }] : []));
    if (fridges.length > 0) places.set(branch.name, fridges);
  }
  const own = places.get(reading.branch) ?? [];
  if (!own.some((option) => option.value === reading.logger_id)) {
    places.set(reading.branch, [...own, { value: reading.logger_id, label: reading.fridge }]);
  }
  return places;
}

/** Edit a reading's place, time, temperature or unit after an "Are you sure?" step, or delete it (it is archived). */
export function EditReadingDialog({ reading, branches, onClose, onSaved }: EditReadingDialogProps) {
  const originalTime = toDateTimeLocal(reading.time);
  const originalTemp = reading.temp === null ? "ERR" : String(reading.temp);
  const places = placeOptions(branches, reading);
  const [branch, setBranch] = useState<string>(reading.branch);
  const [loggerId, setLoggerId] = useState<string>(reading.logger_id);
  const [time, setTime] = useState<string>(originalTime);
  const [temp, setTemp] = useState<string>(originalTemp);
  const [metric, setMetric] = useState<Metric>(reading.metric);
  const [mode, setMode] = useState<Mode>("edit");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);

  const fridges = places.get(branch) ?? [];
  const fridgeName = fridges.find((option) => option.value === loggerId)?.label ?? "";
  const changes: ReadingChanges = {
    ...(loggerId !== reading.logger_id && { logger_id: loggerId }),
    ...(time !== originalTime && { time }),
    ...(temp.trim() !== originalTemp && { temp: temp.trim() }),
    ...(metric !== reading.metric && { metric }),
  };
  const tempChanged = changes.temp !== undefined || changes.metric !== undefined;
  const summary = [
    changes.logger_id && `${reading.branch} · ${reading.fridge} → ${branch} · ${fridgeName}.`,
    changes.time && `${formatShort(originalTime)} → ${formatShort(changes.time)}.`,
    tempChanged && `${tempLabel(originalTemp, reading.metric)} → ${tempLabel(temp, metric)}.`,
  ].filter(Boolean);

  const edit = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setMode("edit");
  };

  // A new branch picks its first fridge, so the logger id always matches a fridge
  const changeBranch = (value: string) => {
    setBranch(value);
    setLoggerId(places.get(value)?.[0]?.value ?? "");
  };

  /** Run a write and map its errors to the fields. */
  const run = async (write: () => Promise<unknown>) => {
    setBusy(true);
    setFailure("");
    try {
      await write();
      onSaved();
    } catch (err) {
      setMode("edit");
      if (err instanceof ApiError && err.status === 409) {
        setErrors({ time: "This logger already has a reading at this time." });
      } else if (err instanceof ApiError && err.fieldErrors.length > 0) {
        setErrors(Object.fromEntries(err.fieldErrors.map((e) => [e.field, e.message])));
      } else {
        setFailure("Could not save the change. Try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  const subtitle = (
    <>
      {`${reading.branch} · ${reading.fridge} · `}
      <span className={styles.mono}>{reading.logger_id}</span>
    </>
  );

  if (mode === "delete") {
    return (
      <Dialog open title="Delete this reading?" subtitle={subtitle} onClose={onClose}>
        <p className={styles.text}>
          The reading is archived with its alerts. They stay available for questions later (Alerts → Archived).
        </p>
        {failure && (
          <p role="alert" className={styles.failure}>
            {failure}
          </p>
        )}
        <div className={styles.buttons}>
          <Button variant="secondary" size="lg" onClick={() => setMode("edit")}>
            Cancel
          </Button>
          <Button variant="danger" size="lg" disabled={busy} onClick={() => run(() => deleteReading(reading.id))}>
            Delete reading
          </Button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog open title="Edit reading" subtitle={subtitle} onClose={onClose}>
      <Field label="Branch">
        {(control) => (
          <Select
            {...control}
            options={[...places.keys()].map((name) => ({ value: name, label: name }))}
            value={branch}
            onChange={edit(changeBranch)}
          />
        )}
      </Field>
      <Field label="Fridge" hint={`Logger ${loggerId}`} error={errors.logger_id}>
        {(control) => <Select {...control} options={fridges} value={loggerId} onChange={edit(setLoggerId)} />}
      </Field>
      <DateTimeField label="Time" value={time} onChange={edit(setTime)} error={errors.time} />
      <TemperatureField
        label={`Temperature (°${metric}, or ERR)`}
        value={temp}
        onChange={edit(setTemp)}
        error={errors.temp}
      />
      <div className={styles.unit}>
        <span className={styles.unitLabel} aria-hidden="true">
          Unit
        </span>
        <SegmentedToggle label="Unit" options={UNITS} value={metric} onChange={edit(setMetric)} />
      </div>
      {mode === "confirm" && (
        <div className={styles.confirm} role="status">
          <strong className={styles.confirmTitle}>Are you sure?</strong>
          <span className={styles.confirmText}>
            {`${summary.join(" ")} The reading is changed in place and the fridge average is recalculated. Edits are not archived.`}
          </span>
        </div>
      )}
      {failure && (
        <p role="alert" className={styles.failure}>
          {failure}
        </p>
      )}
      <div className={styles.buttons}>
        <Button variant="secondary" size="lg" onClick={mode === "confirm" ? () => setMode("edit") : onClose}>
          Cancel
        </Button>
        {mode === "confirm" ? (
          <Button size="lg" disabled={busy} onClick={() => run(() => updateReading(reading.id, changes))}>
            Yes, save
          </Button>
        ) : (
          <Button size="lg" onClick={() => (summary.length > 0 ? (setErrors({}), setMode("confirm")) : onClose())}>
            Save
          </Button>
        )}
      </div>
      <Button variant="danger-link" onClick={() => setMode("delete")}>
        Delete reading (moves to the archive)
      </Button>
    </Dialog>
  );
}

import { useState } from "react";
import { ApiError } from "../../lib/api";
import { deleteReading, updateReading, type Reading } from "../../lib/endpoints";
import { formatShort, toDateTimeLocal } from "../../lib/format";
import { formatTemp } from "../../lib/units";
import { Button } from "../Button/Button";
import { DateTimeField } from "../DateTimeField/DateTimeField";
import { Dialog } from "../Dialog/Dialog";
import { TemperatureField } from "../TemperatureField/TemperatureField";
import styles from "./EditReadingDialog.module.css";

interface EditReadingDialogProps {
  reading: Reading;
  onClose: () => void;
  onSaved: () => void;
}

type Mode = "edit" | "confirm" | "delete";

/** Show a typed temperature the way the list shows it: "4.4 °C", or ERR. */
function tempLabel(text: string, reading: Reading): string {
  if (text.trim().toUpperCase() === "ERR") return "ERR";
  const value = Number(text);
  return text.trim() === "" || Number.isNaN(value) ? text : formatTemp(value, reading.metric, reading.metric);
}

/** Edit a reading's time or temperature after an "Are you sure?" step, or delete it (it is archived). */
export function EditReadingDialog({ reading, onClose, onSaved }: EditReadingDialogProps) {
  const originalTime = toDateTimeLocal(reading.time);
  const originalTemp = reading.temp === null ? "ERR" : String(reading.temp);
  const [time, setTime] = useState<string>(originalTime);
  const [temp, setTemp] = useState<string>(originalTemp);
  const [mode, setMode] = useState<Mode>("edit");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);

  const changes = {
    ...(time !== originalTime && { time }),
    ...(temp.trim() !== originalTemp && { temp: temp.trim() }),
  };
  const summary = [
    changes.time && `${formatShort(originalTime)} → ${formatShort(changes.time)}.`,
    changes.temp !== undefined && `${tempLabel(originalTemp, reading)} → ${tempLabel(changes.temp, reading)}.`,
  ].filter(Boolean);

  const edit = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setMode("edit");
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
      <DateTimeField label="Time" value={time} onChange={edit(setTime)} error={errors.time} />
      <TemperatureField
        label={`Temperature (°${reading.metric}, or ERR)`}
        value={temp}
        onChange={edit(setTemp)}
        error={errors.temp}
      />
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

import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { BranchField } from "../../components/BranchField/BranchField";
import { Button } from "../../components/Button/Button";
import { Card } from "../../components/Card/Card";
import { DateTimeField } from "../../components/DateTimeField/DateTimeField";
import { FridgeField } from "../../components/FridgeField/FridgeField";
import { LoggerField } from "../../components/LoggerField/LoggerField";
import { TemperatureField } from "../../components/TemperatureField/TemperatureField";
import { UnknownEntries } from "../../components/UnknownEntries/UnknownEntries";
import { ApiError } from "../../lib/api";
import {
  addReading,
  listBranches,
  type Branch,
  type NewReading,
  type Registration,
  type SaveResult,
  type UnknownEntries as Entries,
} from "../../lib/endpoints";
import styles from "./SingleRecordPage.module.css";

const EMPTY: NewReading = { logger: "", branch: "", fridge: "", time: "", temp: "" };

/** Say "1 alert" or "2 alerts". */
function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Describe a saved reading, e.g. "Reading saved. 1 alert created." */
function savedMessage(result: SaveResult): string {
  if (!result.inserted) return "This reading was already saved. Nothing changed.";
  const parts = [result.err_rows ? "Reading saved as ERR." : "Reading saved."];
  if (result.alerts) parts.push(`${plural(result.alerts, "alert", "alerts")} created.`);
  return parts.join(" ");
}

/** Add one reading: the same checks as an upload, for a reading typed by hand. */
export function SingleRecordPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [record, setRecord] = useState<NewReading>(EMPTY);
  const [saved, setSaved] = useState<SaveResult | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [unknown, setUnknown] = useState<Entries | null>(null);
  const [registerErrors, setRegisterErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    listBranches()
      .then((result) => active && setBranches(result))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const branch = branches.find((b) => b.name.toLowerCase() === record.branch.trim().toLowerCase());

  /** Change one field of the record. */
  function set(field: keyof NewReading, value: string) {
    setRecord((current) => ({ ...current, [field]: value }));
  }

  /** Change the fridge; a registered fridge also fills its logger id. */
  function setFridge(name: string) {
    const fridge = branch?.fridges.find((f) => f.name.toLowerCase() === name.trim().toLowerCase());
    setRecord((current) => ({ ...current, fridge: name, logger: fridge?.logger_id ?? current.logger }));
  }

  /** Send the record, with the confirmed new entries when given; show the result or the errors. */
  async function send(register?: Registration) {
    setBusy(true);
    setRegisterErrors([]);
    try {
      const result = await addReading(record, register);
      setSaved(result);
      setFieldErrors({});
      setError("");
      setUnknown(null);
    } catch (caught) {
      const body = caught instanceof ApiError ? (caught.body as Partial<SaveResult> | null) : null;
      if (register && caught instanceof ApiError && body?.rejected === undefined) {
        // The register block itself was refused; the reason belongs in the dialog
        setRegisterErrors(caught.fieldErrors.map((e) => e.message));
      } else {
        showRejected(caught);
        setUnknown(body?.unknown ?? null);
      }
    } finally {
      setBusy(false);
    }
  }

  /** Put the rejected fields' messages under their fields; other messages go above the form. */
  function showRejected(caught: unknown) {
    setSaved(null);
    if (!(caught instanceof ApiError)) {
      setFieldErrors({});
      return setError("Could not save the reading. Try again.");
    }
    const byField: Record<string, string> = {};
    const other: string[] = [];
    for (const e of caught.fieldErrors) {
      if (e.field in EMPTY) byField[e.field] ??= e.message;
      else other.push(e.message);
    }
    setFieldErrors(byField);
    setError(other.length || !caught.fieldErrors.length ? other.join(" ") || caught.message : "");
  }

  /** Clear the form and the last result for the next reading. */
  function addAnother() {
    setRecord(EMPTY);
    setSaved(null);
  }

  /** Send the typed record. */
  function submit(event: FormEvent) {
    event.preventDefault();
    void send();
  }

  return (
    <section className={styles.page}>
      <Link to="/readings" className={styles.back}>
        ← Readings
      </Link>
      <h1 className={styles.title}>Add one reading</h1>
      {saved && (
        <Card role="status" className={styles.saved}>
          <p className={styles.savedTitle}>{savedMessage(saved)}</p>
          {saved.renamed_fridges.map((rename) => (
            <p key={rename} className={styles.savedNote}>
              Renamed: {rename}
            </p>
          ))}
          {saved.fridge_name_mismatches.map((m) => (
            <p key={m.row} className={styles.savedNote}>
              Saved to {m.fridge} ({m.logger}), not “{m.name_in_file}”. Check for a typo.
            </p>
          ))}
          <Button variant="secondary" className={styles.another} onClick={addAnother}>
            Add another
          </Button>
        </Card>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <form className={styles.form} onSubmit={submit} noValidate>
        <BranchField
          branches={branches}
          value={record.branch}
          onChange={(v) => set("branch", v)}
          error={fieldErrors.branch}
        />
        <FridgeField branch={branch} value={record.fridge} onChange={setFridge} error={fieldErrors.fridge} />
        <LoggerField
          branch={branch}
          value={record.logger}
          onChange={(v) => set("logger", v)}
          error={fieldErrors.logger}
        />
        <DateTimeField label="Time" value={record.time} onChange={(v) => set("time", v)} error={fieldErrors.time} />
        <TemperatureField
          label="Temperature (number, or ERR)"
          value={record.temp}
          onChange={(v) => set("temp", v)}
          error={fieldErrors.temp}
        />
        <Button type="submit" size="lg">
          Save reading
        </Button>
      </form>
      <p className={styles.note}>Same checks as an upload. A new branch or logger opens the “add it?” step.</p>
      {unknown && (
        <UnknownEntries
          open
          title="New in this reading"
          entries={unknown}
          confirmLabel="Add and save"
          suggestionHint="use it instead"
          onConfirm={(registration) => void send(registration)}
          onPickSuggestion={(name) => {
            set("branch", name);
            setFieldErrors(({ branch: _fixed, ...rest }) => rest);
            setUnknown(null);
          }}
          onClose={() => {
            setUnknown(null);
            setRegisterErrors([]);
          }}
          errors={registerErrors}
          busy={busy}
        />
      )}
    </section>
  );
}

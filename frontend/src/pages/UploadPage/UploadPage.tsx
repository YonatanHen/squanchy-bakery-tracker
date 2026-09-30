import { useState, type ChangeEvent, type DragEvent } from "react";
import { Card } from "../../components/Card/Card";
import { UploadIcon } from "../../components/icons/icons";
import { ApiError } from "../../lib/api";
import { UnknownEntries } from "../../components/UnknownEntries/UnknownEntries";
import {
  uploadReadings,
  type Registration,
  type RowError,
  type SaveResult,
  type UnknownEntries as Entries,
} from "../../lib/endpoints";
import styles from "./UploadPage.module.css";

const FIELD_LABELS: Record<string, string> = {
  logger: "Logger",
  branch: "Branch",
  fridge: "Fridge",
  time: "Time",
  temp: "Temperature",
};

/** Tell whether a rejected value is worth quoting (not empty). */
function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== "";
}

/** Lower-case the first letter, so the message reads on after the dash. */
function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** Say "1 branch" or "2 branches". */
function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Sum up what is unknown, e.g. "1 branch and 1 logger not registered". */
function unknownSummary(unknown: Entries): string {
  const parts = [];
  if (unknown.branches.length) parts.push(plural(unknown.branches.length, "branch", "branches"));
  if (unknown.loggers.length) parts.push(plural(unknown.loggers.length, "logger", "loggers"));
  return `${parts.join(" and ")} not registered`;
}

/** List the unknown branch names and logger ids. */
function unknownNames(unknown: Entries): string {
  return [...unknown.branches.map((b) => b.name), ...unknown.loggers.map((l) => l.logger)].join(", ");
}

/** Note the saved ERR readings and new alerts, e.g. "1 ERR reading saved · 2 alerts created". */
function extras(result: SaveResult): string {
  const parts = [];
  if (result.err_rows) parts.push(`${plural(result.err_rows, "ERR reading", "ERR readings")} saved`);
  if (result.alerts) parts.push(`${plural(result.alerts, "alert", "alerts")} created`);
  return parts.join(" · ");
}

/** Upload screen: pick an .xlsx or .csv file, then see what was saved and which rows to fix. */
export function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [fileErrors, setFileErrors] = useState<RowError[]>([]);
  const [error, setError] = useState<string>("");
  const [reviewing, setReviewing] = useState<boolean>(false);
  const [registerErrors, setRegisterErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState<boolean>(false);

  /** Upload the file and show its result, or why the whole file was rejected. */
  async function upload(chosen: File) {
    setFile(chosen);
    setResult(null);
    setFileErrors([]);
    setError("");
    try {
      setResult(await uploadReadings(chosen));
    } catch (caught) {
      if (caught instanceof ApiError && caught.fieldErrors.length) setFileErrors(caught.fieldErrors);
      else setError(caught instanceof ApiError ? caught.message : "Could not upload the file. Try again.");
    }
  }

  /** Re-send the same file with the confirmed entries; a refusal stays in the dialog. */
  async function register(registration: Registration) {
    if (!file) return;
    setBusy(true);
    setRegisterErrors([]);
    try {
      setResult(await uploadReadings(file, registration));
      setReviewing(false);
    } catch (caught) {
      const apiError = caught instanceof ApiError ? caught : null;
      const messages = apiError?.fieldErrors.map((e) => e.message) ?? [];
      setRegisterErrors(messages.length ? messages : [apiError?.message ?? "Could not add them. Try again."]);
    } finally {
      setBusy(false);
    }
  }

  /** Close the review dialog and forget its errors. */
  function closeReview() {
    setReviewing(false);
    setRegisterErrors([]);
  }

  const errors = result?.errors ?? fileErrors;

  /** Upload the file picked in the input. */
  function onPick(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    event.target.value = "";
    if (chosen) void upload(chosen);
  }

  /** Upload the file dropped on the drop zone. */
  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    const dropped = event.dataTransfer.files[0];
    if (dropped) void upload(dropped);
  }

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Upload readings</h1>
      <div className={styles.columns}>
        <div className={styles.column}>
          <label className={styles.drop} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
            <span className={styles.icon}>
              <UploadIcon />
            </span>
            <span className={`${styles.dropText} ${styles.phone}`}>
              <strong className={styles.dropTitle}>{file ? file.name : "Choose an .xlsx or .csv file"}</strong>
              <span className={styles.dropHint}>
                {file ? "Excel or CSV file · tap to choose another" : "Excel or CSV file"}
              </span>
            </span>
            <span className={`${styles.dropText} ${styles.desktop}`}>
              <strong className={styles.dropTitle}>Drop an .xlsx or .csv file here, or click to choose</strong>
              {file && <span className={styles.dropHint}>Last file: {file.name}</span>}
            </span>
            <input type="file" accept=".xlsx,.csv" className={styles.input} onChange={onPick} />
          </label>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          {result && (
            <ul aria-label="Upload result" className={styles.counts}>
              <li>
                <Card className={styles.count}>
                  <span className={styles.number}>{result.inserted}</span>
                  <span className={styles.countLabel}>saved</span>
                </Card>
              </li>
              <li>
                <Card className={styles.count}>
                  <span className={styles.number}>{result.duplicates}</span>
                  <span className={styles.countLabel}>duplicates skipped</span>
                </Card>
              </li>
              <li>
                <Card tone={result.rejected ? "urgent" : "default"} className={styles.count}>
                  <span className={styles.number}>{result.rejected}</span>
                  <span className={styles.countLabel}>rows to fix</span>
                </Card>
              </li>
            </ul>
          )}
          {result && extras(result) && <p className={styles.extra}>{extras(result)}</p>}
          {result?.renamed_fridges.map((rename) => (
            <p key={rename} className={styles.extra}>
              Renamed: {rename}
            </p>
          ))}
          {result?.unknown && (
            <button type="button" className={styles.unknown} onClick={() => setReviewing(true)}>
              <span className={styles.unknownText}>
                <strong>{unknownSummary(result.unknown)}</strong>
                <br />
                {unknownNames(result.unknown)} — did you mean something else, or add it?
              </span>
              <span className={styles.review}>Review →</span>
            </button>
          )}
        </div>
        <div className={styles.column}>
          {errors.length > 0 && (
            <Card className={styles.fixes}>
              <p className={styles.fixesTitle}>Fix these rows in your file, then upload it again</p>
              <ul aria-label="Rows to fix" className={styles.rows}>
                {errors.map((error, index) => (
                  <li key={index} className={styles.row}>
                    <span className={styles.rowNumber}>Row {error.row}</span>
                    <span>
                      {FIELD_LABELS[error.field] ?? error.field}
                      {hasValue(error.value) && (
                        <>
                          {" "}
                          <strong>“{String(error.value)}”</strong>
                        </>
                      )}{" "}
                      — {lowerFirst(error.message)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className={styles.note}>Rows already saved are skipped on the next upload.</p>
            </Card>
          )}
          {result && result.fridge_name_mismatches.length > 0 && (
            <Card tone="light" className={styles.fixes}>
              <p className={styles.fixesTitle}>Saved, but the fridge name differs. Check for typos</p>
              <ul aria-label="Fridge names to check" className={styles.rows}>
                {result.fridge_name_mismatches.map((mismatch) => (
                  <li key={mismatch.row} className={styles.row}>
                    <span className={styles.rowNumber}>Row {mismatch.row}</span>
                    <span>
                      <strong>“{mismatch.name_in_file}”</strong> — saved to {mismatch.fridge} ({mismatch.logger})
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
      {result?.unknown && (
        <UnknownEntries
          open={reviewing}
          title="New in this file"
          entries={result.unknown}
          confirmLabel="Add and upload again"
          suggestionHint="fix the file and upload again"
          onConfirm={register}
          onClose={closeReview}
          errors={registerErrors}
          busy={busy}
        />
      )}
    </section>
  );
}

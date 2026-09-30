import { useState, type ChangeEvent } from "react";
import { Card } from "../../components/Card/Card";
import { UploadIcon } from "../../components/icons/icons";
import { ApiError } from "../../lib/api";
import { uploadReadings, type RowError, type SaveResult } from "../../lib/endpoints";
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

/** Upload screen: pick an .xlsx file, then see what was saved and which rows to fix. */
export function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [fileErrors, setFileErrors] = useState<RowError[]>([]);
  const [error, setError] = useState("");

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

  const errors = result?.errors ?? fileErrors;

  /** Upload the file picked in the input. */
  function onPick(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    event.target.value = "";
    if (chosen) void upload(chosen);
  }

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Upload readings</h1>
      <div className={styles.columns}>
        <div className={styles.column}>
          <label className={styles.drop}>
            <span className={styles.icon}>
              <UploadIcon />
            </span>
            <span className={styles.dropText}>
              <strong className={styles.dropTitle}>{file ? file.name : "Choose an .xlsx file"}</strong>
              <span className={styles.dropHint}>{file ? "Excel file · tap to choose another" : "Excel file"}</span>
            </span>
            <input type="file" accept=".xlsx" className={styles.input} onChange={onPick} />
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
    </section>
  );
}

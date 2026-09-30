import { useId, type ReactNode } from "react";
import styles from "./Field.module.css";

export interface ControlProps {
  id: string;
  "aria-describedby"?: string | undefined;
  "aria-invalid"?: true | undefined;
}

interface FieldProps {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  children: (control: ControlProps) => ReactNode;
}

/** Render a label, a control, an optional hint and an error linked to the control. */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}

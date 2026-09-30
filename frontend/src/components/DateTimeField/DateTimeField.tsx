import { Field } from "../Field/Field";
import { TextInput } from "../TextInput/TextInput";
import styles from "./DateTimeField.module.css";

interface DateTimeFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  dateOnly?: boolean;
  error?: string;
  hint?: string;
}

/** A labeled native date-time picker; its value is "YYYY-MM-DDTHH:MM" (or "YYYY-MM-DD" when dateOnly). */
export function DateTimeField({ label, value, onChange, dateOnly = false, error, hint }: DateTimeFieldProps) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(control) => (
        <TextInput
          {...control}
          type={dateOnly ? "date" : "datetime-local"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={styles.input}
        />
      )}
    </Field>
  );
}

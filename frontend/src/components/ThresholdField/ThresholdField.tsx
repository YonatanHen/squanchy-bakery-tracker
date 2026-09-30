import { Field } from "../Field/Field";
import { TextInput } from "../TextInput/TextInput";
import styles from "./ThresholdField.module.css";

interface ThresholdFieldProps {
  label: string;
  unit: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

/** A compact threshold input: the unit is the visible label, `label` is its accessible name. */
export function ThresholdField({ label, unit, value, onChange, error }: ThresholdFieldProps) {
  return (
    <div className={styles.wrap}>
      <Field label={unit} error={error}>
        {(control) => (
          <TextInput
            {...control}
            aria-label={label}
            inputMode="decimal"
            autoComplete="off"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className={styles.input}
          />
        )}
      </Field>
    </div>
  );
}

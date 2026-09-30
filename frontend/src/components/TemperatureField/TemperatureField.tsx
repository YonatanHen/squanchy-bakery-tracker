import { Field } from "../Field/Field";
import { TextInput } from "../TextInput/TextInput";
import styles from "./TemperatureField.module.css";

interface TemperatureFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  hint?: string | undefined;
  placeholder?: string | undefined;
}

/** A labeled temperature input; the text is kept as typed so "ERR" can be entered. */
export function TemperatureField({ label, value, onChange, error, hint, placeholder }: TemperatureFieldProps) {
  return (
    <Field label={label} error={error} hint={hint}>
      {(control) => (
        <TextInput
          {...control}
          inputMode="decimal"
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={styles.input}
        />
      )}
    </Field>
  );
}

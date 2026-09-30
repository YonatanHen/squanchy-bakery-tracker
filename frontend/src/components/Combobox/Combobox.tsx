import { useId, useState } from "react";
import { Field } from "../Field/Field";
import { TextInput } from "../TextInput/TextInput";
import styles from "./Combobox.module.css";

interface ComboboxProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  newOptionLabel?: (text: string) => string;
  hint?: string;
  error?: string;
  mono?: boolean;
}

interface Option {
  value: string;
  label: string;
}

/** Pick from a list or type a new value; the list filters as the user types. */
export function Combobox({ label, value, options, onChange, newOptionLabel, hint, error, mono }: ComboboxProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const text = value.trim().toLowerCase();
  const matches: Option[] = options.filter((o) => o.toLowerCase().includes(text)).map((o) => ({ value: o, label: o }));
  const exact = options.some((o) => o.toLowerCase() === text);
  const shown = text && !exact && newOptionLabel ? [...matches, { value, label: newOptionLabel(value) }] : matches;

  /** Use the picked value and close the list. */
  function pick(option: Option) {
    onChange(option.value);
    setOpen(false);
  }

  return (
    <Field label={label} hint={hint} error={error}>
      {(control) => (
        <div className={styles.combobox}>
          <TextInput
            {...control}
            role="combobox"
            aria-expanded={open && shown.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            value={value}
            className={[styles.input, mono && styles.mono].filter(Boolean).join(" ")}
            onChange={(event) => {
              onChange(event.target.value);
              setOpen(true);
            }}
          />
          <svg className={styles.chevron} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
          {open && shown.length > 0 && (
            <ul id={listId} role="listbox" aria-label={label} className={styles.list}>
              {shown.map((option) => (
                <li
                  key={option.label}
                  role="option"
                  aria-selected={false}
                  className={styles.option}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(option)}
                >
                  {option.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Field>
  );
}

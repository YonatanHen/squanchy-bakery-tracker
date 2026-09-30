import { useId, useState, type KeyboardEvent } from "react";
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
  isNew?: boolean;
}

/** Pick from a list or type a new value; the list filters as the user types. */
export function Combobox({ label, value, options, onChange, newOptionLabel, hint, error, mono }: ComboboxProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const text = value.trim().toLowerCase();
  const matches: Option[] = options.filter((o) => o.toLowerCase().includes(text)).map((o) => ({ value: o, label: o }));
  const exact = options.some((o) => o.toLowerCase() === text);
  const shown =
    text && !exact && newOptionLabel ? [...matches, { value, label: newOptionLabel(value), isNew: true }] : matches;

  const expanded = open && shown.length > 0;
  const optionId = (index: number) => `${listId}-${index}`;

  /** Use the picked value and close the list. */
  function pick(option: Option) {
    onChange(option.value);
    setOpen(false);
    setActive(-1);
  }

  /** Arrows move the active option, Enter picks it, Escape closes the list. */
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setOpen(true);
      setActive((current) => (expanded ? Math.min(Math.max(current + step, 0), shown.length - 1) : 0));
    } else if (event.key === "Enter" && expanded && shown[active]) {
      event.preventDefault();
      pick(shown[active]);
    } else if (event.key === "Escape" && expanded) {
      // Keep Escape from also closing a surrounding dialog
      event.stopPropagation();
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <Field label={label} hint={hint} error={error}>
      {(control) => (
        <div className={styles.combobox}>
          <TextInput
            {...control}
            role="combobox"
            aria-expanded={expanded}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
            autoComplete="off"
            value={value}
            className={[styles.input, mono && styles.mono].filter(Boolean).join(" ")}
            onChange={(event) => {
              onChange(event.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onKeyDown={onKeyDown}
            onBlur={() => setOpen(false)}
          />
          <svg className={styles.chevron} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
          {expanded && (
            <ul id={listId} role="listbox" aria-label={label} className={styles.list}>
              {shown.map((option, index) => (
                <li
                  key={option.label}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === active}
                  className={[styles.option, option.isNew && styles.new].filter(Boolean).join(" ")}
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

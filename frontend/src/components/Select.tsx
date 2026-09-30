import type { SelectHTMLAttributes } from "react";
import styles from "../styles/components/Select.module.css";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value"> {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
}

/** Render a styled native select; use it inside a Field for its label and errors. */
export function Select({ options, onChange, className, ...props }: SelectProps) {
  return (
    <select
      {...props}
      onChange={(event) => onChange(event.target.value)}
      className={[styles.select, className].filter(Boolean).join(" ")}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

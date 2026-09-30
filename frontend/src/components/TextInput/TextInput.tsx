import type { InputHTMLAttributes } from "react";
import styles from "./TextInput.module.css";

/** Render a styled text input; use it inside a Field for its label and errors. */
export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="text" {...props} className={[styles.input, className].filter(Boolean).join(" ")} />;
}

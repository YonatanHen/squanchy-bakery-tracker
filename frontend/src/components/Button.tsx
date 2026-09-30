import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
  size?: "md" | "lg";
}

/** Render a button in one of the shared variants; defaults to a primary, non-submit button. */
export function Button({ variant = "primary", size = "md", type = "button", className, ...props }: ButtonProps) {
  const classes = [styles.button, styles[variant], styles[size], className].filter(Boolean).join(" ");
  return <button type={type} data-variant={variant} className={classes} {...props} />;
}

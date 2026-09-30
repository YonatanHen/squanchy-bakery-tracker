import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./IconButton.module.css";

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string;
  icon: ReactNode;
  tone?: "neutral" | "danger";
}

/** Render a 44px icon-only button; `label` is its accessible name. */
export function IconButton({ label, icon, tone = "neutral", className, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      data-tone={tone}
      className={[styles.button, styles[tone], className].filter(Boolean).join(" ")}
      {...props}
    >
      {icon}
    </button>
  );
}

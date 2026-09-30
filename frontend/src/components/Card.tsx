import type { HTMLAttributes } from "react";
import styles from "../styles/components/Card.module.css";

export type Tone = "default" | "urgent" | "light";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
}

/** Render a bordered surface; urgent and light tones follow the alert colors. */
export function Card({ tone = "default", className, ...props }: CardProps) {
  return <div data-tone={tone} className={[styles.card, styles[tone], className].filter(Boolean).join(" ")} {...props} />;
}

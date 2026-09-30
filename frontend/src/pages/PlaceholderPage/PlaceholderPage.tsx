import type { ReactNode } from "react";
import styles from "./PlaceholderPage.module.css";

/** Show a page title only; later branches replace these pages. */
export function PlaceholderPage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <section className={styles.page}>
      <h1 className={styles.title}>{title}</h1>
      {children}
    </section>
  );
}

import type { ReactNode } from "react";
import styles from "./PageHeader.module.css";

/** Show a page's title with its actions (toggles, filters, links) on the right. */
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={styles.header}>
      <h1 className={styles.title}>{title}</h1>
      {children && <div className={styles.actions}>{children}</div>}
    </div>
  );
}

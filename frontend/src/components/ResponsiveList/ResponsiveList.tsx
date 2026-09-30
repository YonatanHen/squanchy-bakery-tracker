import type { Key, ReactNode } from "react";
import type { Tone } from "../Card/Card";
import { DataTable, type Column } from "../DataTable/DataTable";
import styles from "./ResponsiveList.module.css";

interface ResponsiveListProps<T> {
  label: string;
  rows: T[];
  rowKey: (row: T) => Key;
  renderCard: (row: T) => ReactNode;
  columns: Column<T>[];
  rowTone?: (row: T) => Tone;
}

/** Show rows as cards on phones and as a table from 900px up. */
export function ResponsiveList<T>({ label, rows, rowKey, renderCard, columns, rowTone }: ResponsiveListProps<T>) {
  return (
    <>
      <ul aria-label={label} className={styles.cards}>
        {rows.map((row) => (
          <li key={rowKey(row)}>{renderCard(row)}</li>
        ))}
      </ul>
      <div className={styles.table}>
        <DataTable label={label} columns={columns} rows={rows} rowKey={rowKey} rowTone={rowTone} />
      </div>
    </>
  );
}

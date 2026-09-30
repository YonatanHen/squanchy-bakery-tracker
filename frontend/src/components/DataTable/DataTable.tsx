import type { Key, ReactNode } from "react";
import type { Tone } from "../Card/Card";
import styles from "./DataTable.module.css";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  mono?: boolean;
  hideHeader?: boolean;
}

interface DataTableProps<T> {
  label: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => Key;
  rowTone?: (row: T) => Tone;
}

/** Render a labeled table; rows can take the urgent or light alert tone. */
export function DataTable<T>({ label, columns, rows, rowKey, rowTone }: DataTableProps<T>) {
  return (
    <div className={styles.wrap}>
      <table aria-label={label} className={styles.table}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={styles.th}>
                <span className={column.hideHeader ? styles.srOnly : undefined}>{column.header}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const tone = rowTone?.(row) ?? "default";
            return (
              <tr key={rowKey(row)} data-tone={tone} className={styles[tone]}>
                {columns.map((column) => (
                  <td key={column.key} className={column.mono ? `${styles.td} ${styles.mono}` : styles.td}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

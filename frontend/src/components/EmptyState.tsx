import styles from "../styles/components/EmptyState.module.css";

/** Show a message in place of an empty list, with an optional hint. */
export function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className={styles.empty}>
      <p className={styles.message}>{message}</p>
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}

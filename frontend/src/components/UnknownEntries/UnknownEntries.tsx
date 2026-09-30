import type { Registration, UnknownEntries as Entries } from "../../lib/endpoints";
import { Card } from "../Card/Card";
import { Dialog } from "../Dialog/Dialog";
import styles from "./UnknownEntries.module.css";

interface UnknownEntriesProps {
  open: boolean;
  title: string;
  entries: Entries;
  confirmLabel: string;
  suggestionHint: string;
  onConfirm: (registration: Registration) => void;
  onClose: () => void;
  onPickSuggestion?: (name: string) => void;
}

/** "Did you mean / add it?" dialog for unknown branches and loggers; confirming returns the register block. */
export function UnknownEntries({ open, title, entries, suggestionHint, onClose, onPickSuggestion }: UnknownEntriesProps) {
  const suggested = entries.branches.filter((branch) => branch.suggestion);

  return (
    <Dialog open={open} title={title} onClose={onClose}>
      {suggested.map((branch) => (
        <Card key={branch.name} className={styles.entry}>
          <span className={styles.text}>
            Branch <strong>“{branch.name}”</strong> does not exist.
          </span>
          <div className={styles.suggestion}>
            <span className={styles.didYouMean}>Did you mean</span>{" "}
            {onPickSuggestion ? (
              <button type="button" className={styles.chip} onClick={() => onPickSuggestion(branch.suggestion!)}>
                {branch.suggestion}
              </button>
            ) : (
              <strong className={styles.chip}>{branch.suggestion}</strong>
            )}{" "}
            <span className={styles.hint}>→ {suggestionHint}</span>
          </div>
        </Card>
      ))}
    </Dialog>
  );
}

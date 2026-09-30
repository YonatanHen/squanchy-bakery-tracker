import type { DeleteImpact } from "../../lib/endpoints";
import { Dialog } from "../Dialog/Dialog";
import { DialogActions } from "../DialogActions/DialogActions";
import styles from "./DeleteImpactDialog.module.css";

interface DeleteImpactDialogProps {
  kind: "branch" | "fridge";
  name: string;
  impact: DeleteImpact;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
  error?: string;
}

const SUMMARY = {
  branch: "This removes the branch with its fridges and loggers.",
  fridge: "This removes the fridge with its logger.",
};

/** One count with its label, e.g. "5 readings archived"; singular only for 1. */
function Count({ value, noun, verb, archived }: { value: number; noun: string; verb: string; archived?: boolean }) {
  return (
    <div className={archived ? `${styles.count} ${styles.archived}` : styles.count}>
      <b className={styles.value}>{value}</b>
      <span className={styles.label}>{`${value === 1 ? noun : `${noun}s`} ${verb}`}</span>
    </div>
  );
}

/** Confirm a branch or fridge delete, showing what is removed and what is archived. */
export function DeleteImpactDialog({ kind, name, impact, onCancel, onConfirm, busy, error }: DeleteImpactDialogProps) {
  return (
    <Dialog open title={`Delete ${name}?`} onClose={onCancel}>
      <p className={styles.summary}>{SUMMARY[kind]}</p>
      <div className={styles.counts}>
        <Count value={impact.fridges} noun="fridge" verb="removed" />
        <Count value={impact.loggers} noun="logger" verb="removed" />
        <Count value={impact.readings} noun="reading" verb="archived" archived />
        <Count value={impact.alerts} noun="alert" verb="archived" archived />
      </div>
      <p className={styles.note}>Archived readings and alerts stay available for questions later (Alerts → Archived).</p>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <DialogActions confirmLabel={`Delete ${kind}`} variant="danger" busy={busy} onCancel={onCancel} onConfirm={onConfirm} />
    </Dialog>
  );
}

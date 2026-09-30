import { Button } from "../Button/Button";
import styles from "./DialogActions.module.css";

interface DialogActionsProps {
  confirmLabel: string;
  variant?: "primary" | "danger";
  busy?: boolean | undefined;
  onCancel: () => void;
  onConfirm?: () => void;
}

/** Render the Cancel and confirm buttons of a dialog; without onConfirm the confirm button submits the form. */
export function DialogActions({ confirmLabel, variant = "primary", busy, onCancel, onConfirm }: DialogActionsProps) {
  return (
    <div className={styles.actions}>
      <Button variant="secondary" size="lg" className={styles.action} onClick={onCancel}>
        Cancel
      </Button>
      <Button
        type={onConfirm ? "button" : "submit"}
        variant={variant}
        size="lg"
        className={styles.action}
        disabled={busy}
        onClick={onConfirm}
      >
        {confirmLabel}
      </Button>
    </div>
  );
}

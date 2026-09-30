import { formatUsedBy } from "../../lib/format";
import { Button } from "../Button/Button";
import { Card } from "../Card/Card";
import { TrashIcon } from "../icons/icons";
import styles from "./ThresholdSettingsRow.module.css";

interface ThresholdSettingsRowProps {
  name: string;
  fridges: number;
  onOpen: () => void;
  onDelete: () => void;
}

/** Collapsed threshold settings: name and fridge count; delete only when no fridge uses them. */
export function ThresholdSettingsRow({ name, fridges, onOpen, onDelete }: ThresholdSettingsRowProps) {
  return (
    <Card className={styles.row}>
      <button type="button" className={styles.open} onClick={onOpen}>
        <strong className={styles.name}>{name}</strong>{" "}
        <span className={styles.count}>{formatUsedBy(fridges)}</span>
      </button>
      {fridges === 0 && (
        <Button variant="secondary" className={styles.delete} aria-label={`Delete threshold settings ${name}`} onClick={onDelete}>
          <TrashIcon />
        </Button>
      )}
    </Card>
  );
}

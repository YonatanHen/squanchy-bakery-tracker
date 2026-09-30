import { formatUsedBy } from "../../lib/format";
import { Button } from "../Button/Button";
import { Card } from "../Card/Card";
import { TrashIcon } from "../icons/icons";
import styles from "./ProfileRow.module.css";

interface ProfileRowProps {
  name: string;
  fridges: number;
  onOpen: () => void;
  onDelete: () => void;
}

/** A collapsed profile: name and fridge count; delete only when no fridge uses it. */
export function ProfileRow({ name, fridges, onOpen, onDelete }: ProfileRowProps) {
  return (
    <Card className={styles.row}>
      <button type="button" className={styles.open} onClick={onOpen}>
        <strong className={styles.name}>{name}</strong>{" "}
        <span className={styles.count}>{formatUsedBy(fridges)}</span>
      </button>
      {fridges === 0 && (
        <Button variant="secondary" className={styles.delete} aria-label={`Delete profile ${name}`} onClick={onDelete}>
          <TrashIcon />
        </Button>
      )}
    </Card>
  );
}

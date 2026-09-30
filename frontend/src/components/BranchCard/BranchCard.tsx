import type { Branch, Fridge } from "../../lib/endpoints";
import { Button } from "../Button/Button";
import { Card } from "../Card/Card";
import { IconButton } from "../IconButton/IconButton";
import { EditIcon, TrashIcon } from "../icons/icons";
import styles from "./BranchCard.module.css";

interface BranchCardProps {
  branch: Branch;
  settingsNames: Record<number, string>;
  onEdit: (branch: Branch) => void;
  onDelete: (branch: Branch) => void;
  onEditFridge: (fridge: Fridge) => void;
  onDeleteFridge: (fridge: Fridge) => void;
}

/** Join the address parts that are set, e.g. "Herzl 12a, Rishon LeZion"; empty when none is set. */
function formatAddress({ street, building_number, city }: Branch): string {
  const line = [street, building_number].filter(Boolean).join(" ");
  return [line, city].filter(Boolean).join(", ");
}

/** One branch with its address, edit and delete actions, and its fridges. */
export function BranchCard({ branch, settingsNames, onEdit, onDelete, onEditFridge, onDeleteFridge }: BranchCardProps) {
  const address = formatAddress(branch);
  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <div className={styles.info}>
          <strong className={styles.name}>{branch.name}</strong>
          {address ? (
            <span className={styles.address}>{address}</span>
          ) : (
            <Button variant="link" className={styles.addAddress} onClick={() => onEdit(branch)}>
              + Add address
            </Button>
          )}
        </div>
        <IconButton label={`Edit ${branch.name}`} icon={<EditIcon />} onClick={() => onEdit(branch)} />
        <IconButton label={`Delete ${branch.name}`} tone="danger" icon={<TrashIcon />} onClick={() => onDelete(branch)} />
      </div>
      <ul aria-label={`${branch.name} fridges`} className={styles.fridges}>
        {branch.fridges.map((fridge) => (
          <li key={fridge.id} className={styles.fridge}>
            <span className={styles.fridgeName}>{fridge.name}</span>
            <span className={styles.mono}>{fridge.logger_id ?? "—"}</span>
            <span className={styles.mono}>{`°${fridge.metric}`}</span>
            <span className={styles.settings}>{settingsNames[fridge.threshold_settings_id] ?? ""}</span>
            <IconButton label={`Edit fridge ${fridge.name}`} icon={<EditIcon />} onClick={() => onEditFridge(fridge)} />
            <IconButton
              label={`Delete fridge ${fridge.name}`}
              tone="danger"
              icon={<TrashIcon />}
              onClick={() => onDeleteFridge(fridge)}
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}

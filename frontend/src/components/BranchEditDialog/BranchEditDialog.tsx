import { useState, type FormEvent } from "react";
import type { Branch, BranchChanges } from "../../lib/endpoints";
import { saveErrors } from "../../lib/saveErrors";
import { Dialog } from "../Dialog/Dialog";
import { DialogActions } from "../DialogActions/DialogActions";
import { Field } from "../Field/Field";
import { TextInput } from "../TextInput/TextInput";
import styles from "./BranchEditDialog.module.css";

type EditableField = "name" | "city" | "street" | "building_number";

const FIELDS: { key: EditableField; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "city", label: "City" },
  { key: "street", label: "Street" },
  { key: "building_number", label: "Building number" },
];

interface BranchEditDialogProps {
  branch: Branch;
  onSave: (changes: BranchChanges) => Promise<unknown>;
  onCancel: () => void;
}

/** Edit a branch's name and address; saves only the changed fields and shows 422 errors under them. */
export function BranchEditDialog({ branch, onSave, onCancel }: BranchEditDialogProps) {
  const [values, setValues] = useState<Record<EditableField, string>>(() => ({
    name: branch.name,
    city: branch.city ?? "",
    street: branch.street ?? "",
    building_number: branch.building_number ?? "",
  }));
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  /** Save the changed fields; a cleared address field is sent as null. */
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const changes: Record<string, string | null> = {};
    for (const { key } of FIELDS) {
      if (values[key] === (branch[key] ?? "")) continue;
      changes[key] = key === "name" || values[key] !== "" ? values[key] : null;
    }
    if (Object.keys(changes).length === 0) return onCancel();

    setSaving(true);
    try {
      await onSave(changes as BranchChanges);
    } catch (err) {
      const errors = saveErrors(err);
      setFieldErrors(errors.fields);
      setError(errors.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open title="Edit branch" subtitle={branch.name} onClose={onCancel}>
      <form className={styles.form} onSubmit={submit} noValidate>
        {FIELDS.map(({ key, label }) => (
          <Field key={key} label={label} error={fieldErrors[key]}>
            {(control) => (
              <TextInput
                {...control}
                value={values[key]}
                onChange={(event) => setValues((v) => ({ ...v, [key]: event.target.value }))}
              />
            )}
          </Field>
        ))}
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <DialogActions confirmLabel="Save" busy={saving} onCancel={onCancel} />
      </form>
    </Dialog>
  );
}

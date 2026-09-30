import { useState, type FormEvent } from "react";
import type { Registration, UnknownEntries as Entries } from "../../lib/endpoints";
import { Button } from "../Button/Button";
import { Card } from "../Card/Card";
import { Dialog } from "../Dialog/Dialog";
import { Field } from "../Field/Field";
import { TextInput } from "../TextInput/TextInput";
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

interface BranchForm {
  city: string;
  street: string;
  building_number: string;
}

/** "Did you mean / add it?" dialog for unknown branches and loggers; confirming returns the register block. */
export function UnknownEntries({ open, title, onClose, ...props }: UnknownEntriesProps) {
  return (
    <Dialog open={open} title={title} onClose={onClose}>
      <EntriesForm onClose={onClose} {...props} />
    </Dialog>
  );
}

/** The dialog body; mounted only while open, so its inputs start fresh each time. */
function EntriesForm({
  entries,
  confirmLabel,
  suggestionHint,
  onConfirm,
  onClose,
  onPickSuggestion,
}: Omit<UnknownEntriesProps, "open" | "title">) {
  const suggested = entries.branches.filter((branch) => branch.suggestion);
  const newBranches = entries.branches.filter((branch) => !branch.suggestion);
  const [branches, setBranches] = useState<Record<string, BranchForm>>(() =>
    Object.fromEntries(newBranches.map((b) => [b.name, { city: b.name, street: "", building_number: "" }])),
  );

  /** Change one field of a new branch. */
  function setBranch(name: string, field: keyof BranchForm, value: string) {
    setBranches((current) => ({ ...current, [name]: { ...current[name], [field]: value } }));
  }

  /** Send the register block built from the forms; empty optional fields are left out. */
  function submit(event: FormEvent) {
    event.preventDefault();
    onConfirm({
      branches: newBranches.map(({ name }) => {
        const { city, street, building_number } = branches[name];
        return { name, city, ...(street && { street }), ...(building_number && { building_number }) };
      }),
      fridges: [],
    });
  }

  return (
    <form className={styles.form} onSubmit={submit}>
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
      {newBranches.map(({ name }) => (
        <Card key={name} className={styles.entry}>
          <span className={styles.text}>
            Branch <strong>“{name}”</strong> does not exist. Add it?
          </span>
          <Field label="City">
            {(control) => (
              <TextInput {...control} value={branches[name].city} onChange={(e) => setBranch(name, "city", e.target.value)} />
            )}
          </Field>
          <div className={styles.address}>
            <div className={styles.street}>
              <Field label="Street (optional)">
                {(control) => (
                  <TextInput
                    {...control}
                    placeholder="Street"
                    value={branches[name].street}
                    onChange={(e) => setBranch(name, "street", e.target.value)}
                  />
                )}
              </Field>
            </div>
            <Field label="No. (optional)">
              {(control) => (
                <TextInput
                  {...control}
                  placeholder="12a"
                  value={branches[name].building_number}
                  onChange={(e) => setBranch(name, "building_number", e.target.value)}
                />
              )}
            </Field>
          </div>
        </Card>
      ))}
      <div className={styles.actions}>
        <Button variant="secondary" size="lg" className={styles.cancel} onClick={onClose}>
          Not now
        </Button>
        <Button type="submit" size="lg" className={styles.confirm}>
          {confirmLabel}
        </Button>
      </div>
    </form>
  );
}

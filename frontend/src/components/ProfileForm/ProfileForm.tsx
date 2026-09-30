import { useState, type FormEvent } from "react";
import type { ProfileValues, ThresholdKey } from "../../lib/endpoints";
import { formatUsedBy } from "../../lib/format";
import type { ProfileErrors } from "../../lib/profileErrors";
import { Button } from "../Button/Button";
import { Card } from "../Card/Card";
import { Field } from "../Field/Field";
import { TextInput } from "../TextInput/TextInput";
import { ThresholdField } from "../ThresholdField/ThresholdField";
import styles from "./ProfileForm.module.css";

interface Row {
  title: string;
  name: string;
  unit: string;
  unitName: string;
  low: ThresholdKey;
  high: ThresholdKey;
}

const ROWS: Row[] = [
  { title: "Rise over 4 readings", name: "Rise", unit: "°C", unitName: "degrees C", low: "growth_non_urgent", high: "growth_urgent" },
  { title: "Away from average", name: "Deviation", unit: "°C", unitName: "degrees C", low: "deviation_non_urgent", high: "deviation_urgent" },
  { title: "No reading for", name: "Gap", unit: "min", unitName: "minutes", low: "gap_non_urgent_minutes", high: "gap_urgent_minutes" },
];

interface ProfileFormProps {
  initial: ProfileValues;
  fridges?: number;
  errors?: ProfileErrors;
  busy?: boolean;
  onSave: (values: ProfileValues) => void;
}

/** The expanded profile card: name, the six limits, the shared-profile warning and Save. */
export function ProfileForm({ initial, fridges, errors = {}, busy, onSave }: ProfileFormProps) {
  const [values, setValues] = useState(initial);

  /** Update one field. */
  const set = (key: keyof ProfileValues) => (value: string) => setValues((prev) => ({ ...prev, [key]: value }));

  /** Send the typed values. */
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSave(values);
  }

  return (
    <Card className={styles.card}>
      <form className={styles.form} onSubmit={handleSubmit} aria-label="Threshold profile">
        <Field label="Profile name" hint={fridges === undefined ? undefined : formatUsedBy(fridges)} error={errors.name}>
          {(control) => <TextInput {...control} value={values.name} onChange={(event) => set("name")(event.target.value)} />}
        </Field>
        <div className={styles.grid}>
          <span />
          <span className={styles.nonUrgent}>Non-urgent</span>
          <span className={styles.urgent}>Urgent</span>
          {ROWS.map((row) => (
            <div key={row.name} className={styles.row}>
              <span className={styles.rowTitle}>{row.title}</span>
              <ThresholdField
                label={`${row.name} non-urgent, ${row.unitName}`}
                unit={row.unit}
                value={values[row.low]}
                onChange={set(row.low)}
                error={errors[row.low]}
              />
              <ThresholdField
                label={`${row.name} urgent, ${row.unitName}`}
                unit={row.unit}
                value={values[row.high]}
                onChange={set(row.high)}
                error={errors[row.high]}
              />
            </div>
          ))}
        </div>
        {!!fridges && (
          <p className={styles.confirm}>
            <strong>Are you sure?</strong> Saving changes future alerts for{" "}
            {fridges === 1 ? "the 1 fridge that uses" : `all ${fridges} fridges that use`} this profile.
          </p>
        )}
        <Button type="submit" size="lg" disabled={busy}>
          Save profile
        </Button>
      </form>
    </Card>
  );
}

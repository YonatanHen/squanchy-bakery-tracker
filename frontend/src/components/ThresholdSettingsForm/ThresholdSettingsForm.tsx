import { useState, type FormEvent } from "react";
import type { ThresholdKey, ThresholdSettingsValues } from "../../lib/endpoints";
import { formatUsedBy } from "../../lib/format";
import type { ThresholdSettingsErrors } from "../../lib/thresholdSettingsErrors";
import { Button } from "../Button/Button";
import { Card } from "../Card/Card";
import { Field } from "../Field/Field";
import { TextInput } from "../TextInput/TextInput";
import { ThresholdField } from "../ThresholdField/ThresholdField";
import styles from "./ThresholdSettingsForm.module.css";

interface Row {
  title: string;
  unit: string;
  fields: [{ label: string; key: ThresholdKey }, { label: string; key: ThresholdKey }];
}

interface Group {
  columns: [{ text: string; className: string | undefined }, { text: string; className: string | undefined }];
  rows: Row[];
}

const GROUPS: Group[] = [
  {
    columns: [{ text: "Min", className: undefined }, { text: "Max", className: undefined }],
    rows: [
      {
        title: "Temperature limits",
        unit: "°C",
        fields: [
          { label: "Min temperature, degrees C", key: "min_temp" },
          { label: "Max temperature, degrees C", key: "max_temp" },
        ],
      },
    ],
  },
  {
    columns: [{ text: "Non-urgent", className: styles.nonUrgent }, { text: "Urgent", className: styles.urgent }],
    rows: [
      {
        title: "Rise over 4 readings",
        unit: "°C",
        fields: [
          { label: "Rise non-urgent, degrees C", key: "growth_non_urgent" },
          { label: "Rise urgent, degrees C", key: "growth_urgent" },
        ],
      },
      {
        title: "No reading for",
        unit: "min",
        fields: [
          { label: "Gap non-urgent, minutes", key: "gap_non_urgent_minutes" },
          { label: "Gap urgent, minutes", key: "gap_urgent_minutes" },
        ],
      },
    ],
  },
];

interface ThresholdSettingsFormProps {
  initial: ThresholdSettingsValues;
  fridges?: number | undefined;
  errors?: ThresholdSettingsErrors | undefined;
  busy?: boolean | undefined;
  onSave: (values: ThresholdSettingsValues) => void;
}

/** The expanded threshold settings card: name, the min/max limits, the alert thresholds, the shared-settings warning and Save. */
export function ThresholdSettingsForm({ initial, fridges, errors = {}, busy, onSave }: ThresholdSettingsFormProps) {
  const [values, setValues] = useState<ThresholdSettingsValues>(initial);

  /** Update one field. */
  const set = (key: keyof ThresholdSettingsValues) => (value: string) => setValues((prev) => ({ ...prev, [key]: value }));

  /** Send the typed values. */
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSave(values);
  }

  return (
    <Card className={styles.card}>
      <form className={styles.form} onSubmit={handleSubmit} aria-label="Threshold settings">
        <Field label="Name" hint={fridges === undefined ? undefined : formatUsedBy(fridges)} error={errors.name}>
          {(control) => <TextInput {...control} value={values.name} onChange={(event) => set("name")(event.target.value)} />}
        </Field>
        {GROUPS.map((group) => (
          <div key={group.rows[0]?.title} className={styles.grid}>
            <span />
            {group.columns.map((column) => (
              <span key={column.text} className={column.className ?? styles.column}>
                {column.text}
              </span>
            ))}
            {group.rows.map((row) => (
              <div key={row.title} className={styles.row}>
                <span className={styles.rowTitle}>{row.title}</span>
                {row.fields.map((field) => (
                  <ThresholdField
                    key={field.key}
                    label={field.label}
                    unit={row.unit}
                    value={values[field.key]}
                    onChange={set(field.key)}
                    error={errors[field.key]}
                  />
                ))}
              </div>
            ))}
          </div>
        ))}
        {!!fridges && (
          <p className={styles.confirm}>
            <strong>Are you sure?</strong> Saving recalculates the alerts of{" "}
            {fridges === 1 ? "the 1 fridge that uses" : `all ${fridges} fridges that use`} these settings.
          </p>
        )}
        <Button type="submit" size="lg" disabled={busy}>
          Save
        </Button>
      </form>
    </Card>
  );
}

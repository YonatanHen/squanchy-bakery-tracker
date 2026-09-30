import { useState, type FormEvent } from "react";
import type { Fridge, FridgeChanges, ThresholdProfile } from "../../lib/endpoints";
import { saveErrors } from "../../lib/saveErrors";
import type { Metric } from "../../lib/units";
import { Dialog } from "../Dialog/Dialog";
import { DialogActions } from "../DialogActions/DialogActions";
import { Field } from "../Field/Field";
import { SegmentedToggle } from "../SegmentedToggle/SegmentedToggle";
import { Select } from "../Select/Select";
import { TextInput } from "../TextInput/TextInput";
import styles from "./FridgeEditDialog.module.css";

const UNITS = [
  { value: "C", label: "°C" },
  { value: "F", label: "°F" },
] as const;

interface FridgeEditDialogProps {
  fridge: Fridge;
  branchName: string;
  profiles: ThresholdProfile[];
  onSave: (changes: FridgeChanges) => Promise<unknown>;
  onCancel: () => void;
}

/** Edit a fridge's name, unit, logger and threshold profile; saves only the changed fields. */
export function FridgeEditDialog({ fridge, branchName, profiles, onSave, onCancel }: FridgeEditDialogProps) {
  const [name, setName] = useState(fridge.name);
  const [metric, setMetric] = useState<Metric>(fridge.metric);
  const [loggerId, setLoggerId] = useState(fridge.logger_id ?? "");
  const [profileId, setProfileId] = useState(String(fridge.threshold_settings_id));
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  /** Save the changed fields. */
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const changes: FridgeChanges = {};
    if (name !== fridge.name) changes.name = name;
    if (metric !== fridge.metric) changes.metric = metric;
    if (loggerId !== (fridge.logger_id ?? "")) changes.logger_id = loggerId;
    if (Number(profileId) !== fridge.threshold_settings_id) changes.threshold_settings_id = Number(profileId);
    if (Object.keys(changes).length === 0) return onCancel();

    setSaving(true);
    try {
      await onSave(changes);
    } catch (err) {
      const errors = saveErrors(err);
      setFieldErrors(errors.fields);
      setError(errors.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open title="Edit fridge" subtitle={`${branchName} · ${fridge.name}`} onClose={onCancel}>
      <form className={styles.form} onSubmit={submit} noValidate>
        <Field label="Name" error={fieldErrors.name}>
          {(control) => <TextInput {...control} value={name} onChange={(event) => setName(event.target.value)} />}
        </Field>
        <div className={styles.unit}>
          <span className={styles.unitLabel} aria-hidden="true">
            Unit
          </span>
          <SegmentedToggle label="Unit" options={UNITS} value={metric} onChange={setMetric} />
        </div>
        <Field label="Logger" hint="TL- and 4 digits, e.g. TL-0231." error={fieldErrors.logger_id}>
          {(control) => (
            <TextInput
              {...control}
              autoComplete="off"
              className={styles.mono}
              value={loggerId}
              onChange={(event) => setLoggerId(event.target.value)}
            />
          )}
        </Field>
        <Field label="Threshold profile" error={fieldErrors.threshold_settings_id}>
          {(control) => (
            <Select
              {...control}
              options={profiles.map((p) => ({ value: String(p.id), label: p.name }))}
              value={profileId}
              onChange={setProfileId}
            />
          )}
        </Field>
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

import { useCallback, useEffect, useState } from "react";
import { Button } from "../../components/Button/Button";
import { Dialog } from "../../components/Dialog/Dialog";
import { DialogActions } from "../../components/DialogActions/DialogActions";
import { SignOutButton } from "../../components/SignOutButton/SignOutButton";
import { ThresholdSettingsForm } from "../../components/ThresholdSettingsForm/ThresholdSettingsForm";
import { ThresholdSettingsRow } from "../../components/ThresholdSettingsRow/ThresholdSettingsRow";
import { ApiError } from "../../lib/api";
import {
  createThresholdSettings,
  deleteThresholdSettings,
  listThresholdSettings,
  THRESHOLD_KEYS,
  updateThresholdSettings,
  type ThresholdSettings,
  type ThresholdSettingsValues,
} from "../../lib/endpoints";
import { thresholdSettingsErrors, type ThresholdSettingsErrors } from "../../lib/thresholdSettingsErrors";
import styles from "./ThresholdsPage.module.css";

// The backend's suggested limits for the "default" threshold settings
const NEW_SETTINGS: ThresholdSettingsValues = {
  name: "",
  growth_non_urgent: "0.1",
  growth_urgent: "1",
  min_temp: "0",
  max_temp: "5",
  gap_non_urgent_minutes: "15",
  gap_urgent_minutes: "120",
};

/** Turn stored threshold settings into form text. */
function toValues(settings: ThresholdSettings): ThresholdSettingsValues {
  const values = { name: settings.name } as ThresholdSettingsValues;
  for (const key of THRESHOLD_KEYS) values[key] = String(settings[key]);
  return values;
}

/** Thresholds screen: one threshold settings open for editing, the others listed, Sign out on phones. */
export function ThresholdsPage() {
  const [settingsList, setSettingsList] = useState<ThresholdSettings[]>([]);
  const [openId, setOpenId] = useState<number | "new" | null>(null);
  const [error, setError] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<ThresholdSettingsErrors>({});
  const [busy, setBusy] = useState<boolean>(false);
  const [saved, setSaved] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<ThresholdSettings | null>(null);
  const closeDelete = useCallback(() => setDeleting(null), []);

  useEffect(() => {
    let active = true;
    listThresholdSettings()
      .then((result) => active && (setSettingsList(result), setOpenId(result[0]?.id ?? null)))
      .catch(() => active && setError("Could not load the threshold settings. Try again."));
    return () => {
      active = false;
    };
  }, []);

  const open = settingsList.find((s) => s.id === openId);

  /** Open threshold settings (or the new-settings form) and clear the previous messages. */
  function openSettings(id: number | "new") {
    setOpenId(id);
    setFieldErrors({});
    setError("");
    setSaved(false);
  }

  /** Create or replace the open settings; show field errors under the fields and other errors above. */
  async function handleSave(values: ThresholdSettingsValues) {
    setBusy(true);
    setSaved(false);
    try {
      if (open) {
        const updated = await updateThresholdSettings(open.id, values);
        setSettingsList((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      } else {
        const created = await createThresholdSettings(values);
        setSettingsList((prev) => [...prev, created]);
        setOpenId(created.id);
      }
      setFieldErrors({});
      setError("");
      setSaved(true);
    } catch (err) {
      const fields = err instanceof ApiError ? thresholdSettingsErrors(err.fieldErrors) : {};
      setFieldErrors(fields);
      setError(Object.keys(fields).length ? "" : err instanceof ApiError ? err.message : "Could not save the threshold settings. Try again.");
    } finally {
      setBusy(false);
    }
  }

  /** Delete the settings the user confirmed; the backend refuses (409) if a fridge uses them. */
  async function handleDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteThresholdSettings(deleting.id);
      setSettingsList((prev) => prev.filter((s) => s.id !== deleting.id));
      setError("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete the threshold settings. Try again.");
    } finally {
      setBusy(false);
      setDeleting(null);
    }
  }

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Thresholds</h1>
        <Button variant="secondary" className={styles.newButton} onClick={() => openSettings("new")}>
          + New threshold settings
        </Button>
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className={styles.saved}>
          Threshold settings saved.
        </p>
      )}
      {openId === "new" && (
        <ThresholdSettingsForm key="new" initial={NEW_SETTINGS} errors={fieldErrors} busy={busy} onSave={handleSave} />
      )}
      {open && (
        <ThresholdSettingsForm
          key={open.id}
          initial={toValues(open)}
          fridges={open.fridges}
          errors={fieldErrors}
          busy={busy}
          onSave={handleSave}
        />
      )}
      {settingsList
        .filter((s) => s !== open)
        .map((s) => (
          <ThresholdSettingsRow
            key={s.id}
            name={s.name}
            fridges={s.fridges}
            onOpen={() => openSettings(s.id)}
            onDelete={() => setDeleting(s)}
          />
        ))}
      <Dialog open={!!deleting} title={`Delete ${deleting?.name}?`} onClose={closeDelete}>
        <p className={styles.dialogText}>No fridge uses these settings.</p>
        <DialogActions confirmLabel="Delete" variant="danger" busy={busy} onCancel={closeDelete} onConfirm={handleDelete} />
      </Dialog>
      <p className={styles.note}>Move a fridge to other threshold settings from Branches → edit fridge.</p>
      <SignOutButton className={styles.signOut} />
    </section>
  );
}

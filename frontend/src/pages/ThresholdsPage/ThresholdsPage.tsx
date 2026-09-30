import { useCallback, useEffect, useState } from "react";
import { Button } from "../../components/Button/Button";
import { Dialog } from "../../components/Dialog/Dialog";
import { ProfileForm } from "../../components/ProfileForm/ProfileForm";
import { ProfileRow } from "../../components/ProfileRow/ProfileRow";
import { SignOutButton } from "../../components/SignOutButton/SignOutButton";
import { ApiError } from "../../lib/api";
import {
  createProfile,
  deleteProfile,
  listProfiles,
  THRESHOLD_KEYS,
  updateProfile,
  type ProfileValues,
  type ThresholdProfile,
} from "../../lib/endpoints";
import { profileErrors, type ProfileErrors } from "../../lib/profileErrors";
import styles from "./ThresholdsPage.module.css";

// The backend's suggested limits for the "default" profile
const NEW_PROFILE: ProfileValues = {
  name: "",
  growth_non_urgent: "0.1",
  growth_urgent: "1",
  deviation_non_urgent: "1.5",
  deviation_urgent: "3",
  gap_non_urgent_minutes: "15",
  gap_urgent_minutes: "120",
};

/** Turn a stored profile into form text. */
function toValues(profile: ThresholdProfile): ProfileValues {
  const values = { name: profile.name } as ProfileValues;
  for (const key of THRESHOLD_KEYS) values[key] = String(profile[key]);
  return values;
}

/** Thresholds screen: one profile open for editing, the others listed, Sign out on phones. */
export function ThresholdsPage() {
  const [profiles, setProfiles] = useState<ThresholdProfile[]>([]);
  const [openId, setOpenId] = useState<number | "new" | null>(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ProfileErrors>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState<ThresholdProfile | null>(null);
  const closeDelete = useCallback(() => setDeleting(null), []);

  useEffect(() => {
    let active = true;
    listProfiles()
      .then((result) => active && (setProfiles(result), setOpenId(result[0]?.id ?? null)))
      .catch(() => active && setError("Could not load the threshold settings. Try again."));
    return () => {
      active = false;
    };
  }, []);

  const open = profiles.find((p) => p.id === openId);

  /** Open a profile (or the new-profile form) and clear the previous messages. */
  function openProfile(id: number | "new") {
    setOpenId(id);
    setFieldErrors({});
    setError("");
    setSaved(false);
  }

  /** Create or replace the open profile; show 422 errors under the fields and other errors above. */
  async function handleSave(values: ProfileValues) {
    setBusy(true);
    setSaved(false);
    try {
      if (open) {
        const updated = await updateProfile(open.id, values);
        setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      } else {
        const created = await createProfile(values);
        setProfiles((prev) => [...prev, created]);
        setOpenId(created.id);
      }
      setFieldErrors({});
      setError("");
      setSaved(true);
    } catch (err) {
      const fields = err instanceof ApiError && err.status === 422 ? profileErrors(err.fieldErrors) : {};
      setFieldErrors(fields);
      setError(Object.keys(fields).length ? "" : err instanceof ApiError ? err.message : "Could not save the threshold settings. Try again.");
    } finally {
      setBusy(false);
    }
  }

  /** Delete the profile the user confirmed; the backend refuses (409) if a fridge uses it. */
  async function handleDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteProfile(deleting.id);
      setProfiles((prev) => prev.filter((p) => p.id !== deleting.id));
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
        <Button variant="secondary" className={styles.newButton} onClick={() => openProfile("new")}>
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
      {openId === "new" && <ProfileForm key="new" initial={NEW_PROFILE} errors={fieldErrors} busy={busy} onSave={handleSave} />}
      {open && (
        <ProfileForm
          key={open.id}
          initial={toValues(open)}
          fridges={open.fridges}
          errors={fieldErrors}
          busy={busy}
          onSave={handleSave}
        />
      )}
      {profiles
        .filter((p) => p !== open)
        .map((p) => (
          <ProfileRow key={p.id} name={p.name} fridges={p.fridges} onOpen={() => openProfile(p.id)} onDelete={() => setDeleting(p)} />
        ))}
      <Dialog open={!!deleting} title={`Delete ${deleting?.name}?`} onClose={closeDelete}>
        <p className={styles.dialogText}>No fridge uses these settings.</p>
        <div className={styles.actions}>
          <Button variant="secondary" size="lg" onClick={closeDelete}>
            Cancel
          </Button>
          <Button variant="danger" size="lg" disabled={busy} onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </Dialog>
      <p className={styles.note}>Move a fridge to other threshold settings from Branches → edit fridge.</p>
      <SignOutButton className={styles.signOut} />
    </section>
  );
}

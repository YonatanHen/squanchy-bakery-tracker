import { useEffect, useState } from "react";
import { ProfileForm } from "../../components/ProfileForm/ProfileForm";
import { ProfileRow } from "../../components/ProfileRow/ProfileRow";
import { SignOutButton } from "../../components/SignOutButton/SignOutButton";
import { ApiError } from "../../lib/api";
import {
  listProfiles,
  THRESHOLD_KEYS,
  updateProfile,
  type ProfileValues,
  type ThresholdProfile,
} from "../../lib/endpoints";
import { profileErrors, type ProfileErrors } from "../../lib/profileErrors";
import styles from "./ThresholdsPage.module.css";

/** Turn a stored profile into form text. */
function toValues(profile: ThresholdProfile): ProfileValues {
  const values = { name: profile.name } as ProfileValues;
  for (const key of THRESHOLD_KEYS) values[key] = String(profile[key]);
  return values;
}

/** Thresholds screen: one profile open for editing, the others listed, Sign out on phones. */
export function ThresholdsPage() {
  const [profiles, setProfiles] = useState<ThresholdProfile[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<ProfileErrors>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    listProfiles()
      .then((result) => active && (setProfiles(result), setOpenId(result[0]?.id ?? null)))
      .catch(() => active && setError("Could not load the threshold profiles. Try again."));
    return () => {
      active = false;
    };
  }, []);

  const open = profiles.find((p) => p.id === openId);

  /** Open a profile and clear the previous messages. */
  function openProfile(id: number | null) {
    setOpenId(id);
    setFieldErrors({});
    setError("");
    setSaved(false);
  }

  /** Save the open profile; show 422 errors under the fields and other errors above. */
  async function handleSave(values: ProfileValues) {
    if (!open) return;
    setBusy(true);
    setSaved(false);
    try {
      const updated = await updateProfile(open.id, values);
      setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setFieldErrors({});
      setError("");
      setSaved(true);
    } catch (err) {
      const fields = err instanceof ApiError && err.status === 422 ? profileErrors(err.fieldErrors) : {};
      setFieldErrors(fields);
      setError(Object.keys(fields).length ? "" : err instanceof ApiError ? err.message : "Could not save the profile. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Thresholds</h1>
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className={styles.saved}>
          Profile saved.
        </p>
      )}
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
          <ProfileRow key={p.id} name={p.name} fridges={p.fridges} onOpen={() => openProfile(p.id)} onDelete={() => {}} />
        ))}
      <p className={styles.note}>Move a fridge to another profile from Branches → edit fridge.</p>
      <SignOutButton className={styles.signOut} />
    </section>
  );
}

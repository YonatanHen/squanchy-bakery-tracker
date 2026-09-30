import { useEffect, useState } from "react";
import { ProfileForm } from "../../components/ProfileForm/ProfileForm";
import { ProfileRow } from "../../components/ProfileRow/ProfileRow";
import { SignOutButton } from "../../components/SignOutButton/SignOutButton";
import { listProfiles, THRESHOLD_KEYS, type ProfileValues, type ThresholdProfile } from "../../lib/endpoints";
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
      {open && <ProfileForm key={open.id} initial={toValues(open)} fridges={open.fridges} onSave={() => {}} />}
      {profiles
        .filter((p) => p !== open)
        .map((p) => (
          <ProfileRow key={p.id} name={p.name} fridges={p.fridges} onOpen={() => setOpenId(p.id)} onDelete={() => {}} />
        ))}
      <p className={styles.note}>Move a fridge to another profile from Branches → edit fridge.</p>
      <SignOutButton className={styles.signOut} />
    </section>
  );
}

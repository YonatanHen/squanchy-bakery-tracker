import { useCallback, useEffect, useState } from "react";
import { BranchCard } from "../../components/BranchCard/BranchCard";
import { EmptyState } from "../../components/EmptyState/EmptyState";
import { listBranches, listThresholdProfiles, type Branch } from "../../lib/endpoints";
import styles from "./BranchesPage.module.css";

/** Branches screen: each branch with its fridges and loggers, with edit and delete. */
export function BranchesPage() {
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [profileNames, setProfileNames] = useState<Record<number, string>>({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [loaded, profiles] = await Promise.all([listBranches(), listThresholdProfiles()]);
      setBranches(loaded);
      setProfileNames(Object.fromEntries(profiles.map((p) => [p.id, p.name])));
      setError("");
    } catch {
      setError("Could not load the branches. Try again.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const noop = () => {};

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Branches</h1>
      <p className={styles.intro}>New branches, fridges and loggers are added from uploads.</p>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {branches && branches.length === 0 && <EmptyState message="No branches yet." />}
      {branches?.map((branch) => (
        <BranchCard
          key={branch.id}
          branch={branch}
          profileNames={profileNames}
          onEdit={noop}
          onDelete={noop}
          onEditFridge={noop}
          onDeleteFridge={noop}
        />
      ))}
    </section>
  );
}

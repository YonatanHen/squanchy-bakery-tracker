import { useCallback, useEffect, useState } from "react";
import { BranchCard } from "../../components/BranchCard/BranchCard";
import { DeleteImpactDialog } from "../../components/DeleteImpactDialog/DeleteImpactDialog";
import { EmptyState } from "../../components/EmptyState/EmptyState";
import {
  deleteBranch,
  deleteImpact,
  listBranches,
  listThresholdProfiles,
  type Branch,
  type DeleteImpact,
} from "../../lib/endpoints";
import styles from "./BranchesPage.module.css";

interface PendingDelete {
  kind: "branch" | "fridge";
  id: number;
  name: string;
  impact: DeleteImpact;
}

/** Branches screen: each branch with its fridges and loggers, with edit and delete. */
export function BranchesPage() {
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [profileNames, setProfileNames] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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

  /** Fetch the delete impact and open the confirmation; nothing is deleted yet. */
  const askDeleteBranch = async (branch: Branch) => {
    try {
      const impact = await deleteImpact("branches", branch.id);
      setDeleteError("");
      setPendingDelete({ kind: "branch", id: branch.id, name: branch.name, impact });
    } catch {
      setError("Could not check what the delete removes. Try again.");
    }
  };

  /** Run the confirmed delete, then reload the list. */
  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteBranch(pendingDelete.id);
      setPendingDelete(null);
      await load();
    } catch {
      setDeleteError("Could not delete. Try again.");
    } finally {
      setDeleting(false);
    }
  };

  const closeDelete = useCallback(() => setPendingDelete(null), []);
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
          onDelete={askDeleteBranch}
          onEditFridge={noop}
          onDeleteFridge={noop}
        />
      ))}
      {pendingDelete && (
        <DeleteImpactDialog
          kind={pendingDelete.kind}
          name={pendingDelete.name}
          impact={pendingDelete.impact}
          busy={deleting}
          error={deleteError}
          onCancel={closeDelete}
          onConfirm={confirmDelete}
        />
      )}
    </section>
  );
}

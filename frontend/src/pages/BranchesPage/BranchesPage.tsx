import { useCallback, useEffect, useMemo, useState } from "react";
import { BranchCard } from "../../components/BranchCard/BranchCard";
import { BranchEditDialog } from "../../components/BranchEditDialog/BranchEditDialog";
import { DeleteImpactDialog } from "../../components/DeleteImpactDialog/DeleteImpactDialog";
import { EmptyState } from "../../components/EmptyState/EmptyState";
import { FridgeEditDialog } from "../../components/FridgeEditDialog/FridgeEditDialog";
import {
  deleteBranch,
  deleteFridge,
  deleteImpact,
  listBranches,
  listThresholdSettings,
  updateBranch,
  updateFridge,
  type Branch,
  type BranchChanges,
  type DeleteImpact,
  type Fridge,
  type FridgeChanges,
  type ThresholdSettings,
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
  const [thresholdSettings, setThresholdSettings] = useState<ThresholdSettings[]>([]);
  const [error, setError] = useState<string>("");
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string>("");
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [editingFridge, setEditingFridge] = useState<{ fridge: Fridge; branchName: string } | null>(null);
  const settingsNames = useMemo(
    () => Object.fromEntries(thresholdSettings.map((s) => [s.id, s.name])),
    [thresholdSettings],
  );

  const load = useCallback(async () => {
    try {
      const [loaded, settings] = await Promise.all([listBranches(), listThresholdSettings()]);
      setBranches(loaded);
      setThresholdSettings(settings);
      setError("");
    } catch {
      setError("Could not load the branches. Try again.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Fetch the delete impact and open the confirmation; nothing is deleted yet. */
  const askDelete = async (kind: PendingDelete["kind"], { id, name }: { id: number; name: string }) => {
    try {
      const impact = await deleteImpact(kind === "branch" ? "branches" : "fridges", id);
      setDeleteError("");
      setPendingDelete({ kind, id, name, impact });
    } catch {
      setError("Could not check what the delete removes. Try again.");
    }
  };

  /** Run the confirmed delete, then reload the list. */
  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await (pendingDelete.kind === "branch" ? deleteBranch : deleteFridge)(pendingDelete.id);
      setPendingDelete(null);
      await load();
    } catch {
      setDeleteError("Could not delete. Try again.");
    } finally {
      setDeleting(false);
    }
  };

  /** Save the branch edit, then close the dialog and reload the list; errors stay in the dialog. */
  const saveBranch = async (changes: BranchChanges) => {
    if (!editingBranch) return;
    await updateBranch(editingBranch.id, changes);
    setEditingBranch(null);
    await load();
  };

  /** Save the fridge edit, then close the dialog and reload the list; errors stay in the dialog. */
  const saveFridge = async (changes: FridgeChanges) => {
    if (!editingFridge) return;
    await updateFridge(editingFridge.fridge.id, changes);
    setEditingFridge(null);
    await load();
  };

  const closeDelete = useCallback(() => setPendingDelete(null), []);
  const closeBranchEdit = useCallback(() => setEditingBranch(null), []);
  const closeFridgeEdit = useCallback(() => setEditingFridge(null), []);

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
          settingsNames={settingsNames}
          onEdit={setEditingBranch}
          onDelete={(b) => askDelete("branch", b)}
          onEditFridge={(fridge) => setEditingFridge({ fridge, branchName: branch.name })}
          onDeleteFridge={(f) => askDelete("fridge", f)}
        />
      ))}
      {editingBranch && <BranchEditDialog branch={editingBranch} onSave={saveBranch} onCancel={closeBranchEdit} />}
      {editingFridge && (
        <FridgeEditDialog
          fridge={editingFridge.fridge}
          branchName={editingFridge.branchName}
          thresholdSettings={thresholdSettings}
          onSave={saveFridge}
          onCancel={closeFridgeEdit}
        />
      )}
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

import { useEffect, useState } from "react";
import { cleanArchive, listAlerts, listReadings, type ArchiveCounts } from "../../lib/endpoints";
import { Button } from "../Button/Button";
import { Dialog } from "../Dialog/Dialog";
import { DialogActions } from "../DialogActions/DialogActions";
import styles from "./CleanArchive.module.css";

interface CleanArchiveProps {
  reloadKey: number;
  onCleaned: () => void;
  onError: (message: string) => void;
}

/** Count the whole archive, ignoring the filters: archived readings and archived alerts. */
async function loadArchiveCounts(): Promise<ArchiveCounts> {
  const [readings, alerts] = await Promise.all([listReadings({}, "C", 0, true), listAlerts({ archived: true, limit: 1 })]);
  return { readings: readings.total, alerts: alerts.total };
}

/** "1 alert" or "3 alerts". */
function plural(count: number, noun: string): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

/** "Clean archive" button and its confirmation; deletes all archived readings and their archived alerts. */
export function CleanArchive({ reloadKey, onCleaned, onError }: CleanArchiveProps) {
  const [counts, setCounts] = useState<ArchiveCounts | null>(null);
  const [open, setOpen] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    setCounts(null);
    loadArchiveCounts()
      .then((result) => active && setCounts(result))
      .catch(() => active && setCounts(null));
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const onClean = () => {
    setBusy(true);
    cleanArchive()
      .then(onCleaned)
      .catch(() => onError("Could not clean the archive. Try again."))
      .finally(() => {
        setBusy(false);
        setOpen(false);
      });
  };

  return (
    <>
      <Button variant="danger" disabled={!counts || counts.readings === 0} onClick={() => setOpen(true)}>
        Clean archive
      </Button>
      {open && counts && (
        <Dialog open title="Clean archive" onClose={() => setOpen(false)}>
          <p className={styles.text}>{`Delete ${plural(counts.readings, "archived reading")} for good?`}</p>
          <p role="alert" className={styles.warning}>
            <strong>{`Their ${plural(counts.alerts, "archived alert")} will be deleted as well.`}</strong> This cannot be
            undone.
          </p>
          <DialogActions
            confirmLabel="Delete for good"
            variant="danger"
            busy={busy}
            onCancel={() => setOpen(false)}
            onConfirm={onClean}
          />
        </Dialog>
      )}
    </>
  );
}

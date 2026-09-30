import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { BranchField } from "../../components/BranchField/BranchField";
import { Button } from "../../components/Button/Button";
import { Card } from "../../components/Card/Card";
import { DateTimeField } from "../../components/DateTimeField/DateTimeField";
import { FridgeField } from "../../components/FridgeField/FridgeField";
import { LoggerField } from "../../components/LoggerField/LoggerField";
import { TemperatureField } from "../../components/TemperatureField/TemperatureField";
import { addReading, listBranches, type Branch, type NewReading, type SaveResult } from "../../lib/endpoints";
import styles from "./SingleRecordPage.module.css";

const EMPTY: NewReading = { logger: "", branch: "", fridge: "", time: "", temp: "" };

/** Say "1 alert" or "2 alerts". */
function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Describe a saved reading, e.g. "Reading saved. 1 alert created." */
function savedMessage(result: SaveResult): string {
  const parts = ["Reading saved."];
  if (result.alerts) parts.push(`${plural(result.alerts, "alert", "alerts")} created.`);
  return parts.join(" ");
}

/** Add one reading: the same checks as an upload, for a reading typed by hand. */
export function SingleRecordPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [record, setRecord] = useState<NewReading>(EMPTY);
  const [saved, setSaved] = useState<SaveResult | null>(null);

  useEffect(() => {
    let active = true;
    listBranches()
      .then((result) => active && setBranches(result))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const branch = branches.find((b) => b.name.toLowerCase() === record.branch.trim().toLowerCase());

  /** Change one field of the record. */
  function set(field: keyof NewReading, value: string) {
    setRecord((current) => ({ ...current, [field]: value }));
  }

  /** Send the record and show the result. */
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaved(await addReading(record));
  }

  return (
    <section className={styles.page}>
      <Link to="/readings" className={styles.back}>
        ← Readings
      </Link>
      <h1 className={styles.title}>Add one reading</h1>
      {saved && (
        <Card role="status" className={styles.saved}>
          {savedMessage(saved)}
        </Card>
      )}
      <form className={styles.form} onSubmit={submit} noValidate>
        <BranchField branches={branches} value={record.branch} onChange={(v) => set("branch", v)} />
        <FridgeField branch={branch} value={record.fridge} onChange={(v) => set("fridge", v)} />
        <LoggerField branch={branch} value={record.logger} onChange={(v) => set("logger", v)} />
        <DateTimeField label="Time" value={record.time} onChange={(v) => set("time", v)} />
        <TemperatureField label="Temperature (number, or ERR)" value={record.temp} onChange={(v) => set("temp", v)} />
        <Button type="submit" size="lg">
          Save reading
        </Button>
      </form>
      <p className={styles.note}>Same checks as an upload. A new branch or logger opens the “add it?” step.</p>
    </section>
  );
}

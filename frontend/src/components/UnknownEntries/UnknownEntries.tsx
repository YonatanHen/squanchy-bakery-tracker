import { useState, type FormEvent } from "react";
import type { Registration, UnknownEntries as Entries } from "../../lib/endpoints";
import { Button } from "../Button/Button";
import { Card } from "../Card/Card";
import { Dialog } from "../Dialog/Dialog";
import type { Metric } from "../../lib/units";
import { Field } from "../Field/Field";
import { SegmentedToggle } from "../SegmentedToggle/SegmentedToggle";
import { TextInput } from "../TextInput/TextInput";
import styles from "./UnknownEntries.module.css";

interface UnknownEntriesProps {
  open: boolean;
  title: string;
  entries: Entries;
  confirmLabel: string;
  suggestionHint: string;
  onConfirm: (registration: Registration) => void;
  onClose: () => void;
  onPickSuggestion?: ((name: string) => void) | undefined;
  errors?: string[] | undefined;
  busy?: boolean | undefined;
}

const UNITS = [
  { value: "C", label: "°C" },
  { value: "F", label: "°F" },
] as const;

interface LoggerForm {
  logger: string;
  branch: string;
  logger_id: string;
  fridge: string;
  metric: Metric;
}

interface BranchForm {
  name: string;
  city: string;
  street: string;
  building_number: string;
}

/** Return a copy of `list` with the item at `index` merged with `changes`. */
function replaceAt<T>(list: T[], index: number, changes: Partial<T>): T[] {
  return list.map((item, i) => (i === index ? { ...item, ...changes } : item));
}

/** "Did you mean / add it?" dialog for unknown branches and loggers; confirming returns the register block. */
export function UnknownEntries({ open, title, onClose, ...props }: UnknownEntriesProps) {
  return (
    <Dialog open={open} title={title} onClose={onClose}>
      <EntriesForm onClose={onClose} {...props} />
    </Dialog>
  );
}

/** The dialog body; mounted only while open, so its inputs start fresh each time. */
function EntriesForm({
  entries,
  confirmLabel,
  suggestionHint,
  onConfirm,
  onClose,
  onPickSuggestion,
  errors = [],
  busy = false,
}: Omit<UnknownEntriesProps, "open" | "title">) {
  const suggested = entries.branches.flatMap(({ name, suggestion }) => (suggestion ? [{ name, suggestion }] : []));
  const misspelled = new Set(suggested.map((branch) => branch.name.toLowerCase()));
  const blocked = entries.loggers.filter((logger) => misspelled.has(logger.branch.toLowerCase()));
  const [branches, setBranches] = useState<BranchForm[]>(() =>
    entries.branches
      .filter((b) => !b.suggestion)
      .map((b) => ({ name: b.name, city: b.name, street: "", building_number: "" })),
  );
  const [loggers, setLoggers] = useState<LoggerForm[]>(() =>
    entries.loggers
      .filter((l) => !misspelled.has(l.branch.toLowerCase()))
      .map((l) => ({ logger: l.logger, branch: l.branch, logger_id: l.logger, fridge: l.fridge, metric: "C" })),
  );

  /** Send the register block built from the forms; empty optional fields are left out. */
  function submit(event: FormEvent) {
    event.preventDefault();
    onConfirm({
      branches: branches.map(({ name, city, street, building_number }) => ({
        name,
        city,
        ...(street && { street }),
        ...(building_number && { building_number }),
      })),
      fridges: loggers.map(({ logger_id, branch, fridge, metric }) => ({ logger_id, branch, fridge, metric })),
    });
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      {suggested.map((branch) => (
        <Card key={branch.name} className={styles.entry}>
          <span className={styles.text}>
            Branch <strong>“{branch.name}”</strong> does not exist.
          </span>
          <div className={styles.suggestion}>
            <span className={styles.didYouMean}>Did you mean</span>{" "}
            {onPickSuggestion ? (
              <button type="button" className={styles.chip} onClick={() => onPickSuggestion(branch.suggestion)}>
                {branch.suggestion}
              </button>
            ) : (
              <strong className={styles.chip}>{branch.suggestion}</strong>
            )}{" "}
            <span className={styles.hint}>→ {suggestionHint}</span>
          </div>
        </Card>
      ))}
      {branches.map((form, index) => (
        <Card key={form.name} className={styles.entry}>
          <span className={styles.text}>
            Branch <strong>“{form.name}”</strong> does not exist. Add it?
          </span>
          <Field label="City">
            {(control) => (
              <TextInput
                {...control}
                value={form.city}
                onChange={(e) => setBranches((list) => replaceAt(list, index, { city: e.target.value }))}
              />
            )}
          </Field>
          <div className={styles.address}>
            <div className={styles.street}>
              <Field label="Street (optional)">
                {(control) => (
                  <TextInput
                    {...control}
                    placeholder="Street"
                    value={form.street}
                    onChange={(e) => setBranches((list) => replaceAt(list, index, { street: e.target.value }))}
                  />
                )}
              </Field>
            </div>
            <Field label="No. (optional)">
              {(control) => (
                <TextInput
                  {...control}
                  placeholder="12a"
                  value={form.building_number}
                  onChange={(e) => setBranches((list) => replaceAt(list, index, { building_number: e.target.value }))}
                />
              )}
            </Field>
          </div>
        </Card>
      ))}
      {loggers.map((form, index) => (
        <Card key={form.logger} className={styles.entry}>
          <span className={styles.text}>
            Logger <strong className={styles.mono}>{form.logger}</strong> does not exist. Add it, or edit before adding.
          </span>
          <div className={styles.pair}>
            <Field label="Logger id">
              {(control) => (
                <TextInput
                  {...control}
                  className={styles.mono}
                  value={form.logger_id}
                  onChange={(e) => setLoggers((list) => replaceAt(list, index, { logger_id: e.target.value }))}
                />
              )}
            </Field>
            <Field label="Fridge">
              {(control) => (
                <TextInput
                  {...control}
                  value={form.fridge}
                  onChange={(e) => setLoggers((list) => replaceAt(list, index, { fridge: e.target.value }))}
                />
              )}
            </Field>
          </div>
          <div className={styles.unit}>
            <span className={styles.unitLabel}>Unit</span>
            <SegmentedToggle
              label="Unit"
              options={UNITS}
              value={form.metric}
              onChange={(metric) => setLoggers((list) => replaceAt(list, index, { metric }))}
            />
          </div>
          <span className={styles.hint}>
            Thresholds: <strong>default</strong> threshold settings (change later in Thresholds)
          </span>
        </Card>
      ))}
      {blocked.map(({ logger, branch }) => (
        <Card key={logger} className={styles.entry}>
          <span className={styles.text}>
            Logger <strong className={styles.mono}>{logger}</strong> does not exist. Fix its branch “{branch}” first.
          </span>
        </Card>
      ))}
      {errors.length > 0 && (
        <div role="alert" className={styles.errors}>
          {errors.map((message) => (
            <p key={message} className={styles.error}>
              {message}
            </p>
          ))}
        </div>
      )}
      <div className={styles.actions}>
        <Button variant="secondary" size="lg" className={styles.cancel} onClick={onClose}>
          Not now
        </Button>
        {(branches.length > 0 || loggers.length > 0) && (
          <Button type="submit" size="lg" className={styles.confirm} disabled={busy}>
            {confirmLabel}
          </Button>
        )}
      </div>
    </form>
  );
}

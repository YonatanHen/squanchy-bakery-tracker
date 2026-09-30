import { useEffect, useState, type FormEvent } from "react";
import type { Branch, ReadingFilters as Filters } from "../../lib/endpoints";
import type { Metric } from "../../lib/units";
import { Button } from "../Button/Button";
import { DateTimeField } from "../DateTimeField/DateTimeField";
import { Field } from "../Field/Field";
import { Select } from "../Select/Select";
import { TemperatureField } from "../TemperatureField/TemperatureField";
import styles from "./ReadingFilters.module.css";

interface ReadingFiltersProps {
  branches: Branch[];
  unit: Metric;
  value: Filters;
  errors?: Record<string, string>;
  onApply: (filters: Filters) => void;
}

/** Turn "2026-09-14" into "14/09/2026". */
function dayLabel(day: string): string {
  return day.split("-").reverse().join("/");
}

/** Build the chip label for each applied filter. */
function chips(value: Filters, unit: Metric): [keyof Filters, string][] {
  const labels: [keyof Filters, string | undefined][] = [
    ["branch", value.branch && `Branch: ${value.branch}`],
    ["fridge", value.fridge && `Fridge: ${value.fridge}`],
    ["dateFrom", value.dateFrom && `From ${dayLabel(value.dateFrom)}`],
    ["dateTo", value.dateTo && `To ${dayLabel(value.dateTo)}`],
    ["tempMin", value.tempMin && `Above ${value.tempMin} °${unit}`],
    ["tempMax", value.tempMax && `Below ${value.tempMax} °${unit}`],
  ];
  return labels.filter((entry): entry is [keyof Filters, string] => Boolean(entry[1]));
}

/** Readings filters: a form (always shown on desktop, opened with "+ Filter" on phones) and chips. */
export function ReadingFilters({ branches, unit, value, errors = {}, onApply }: ReadingFiltersProps) {
  const [draft, setDraft] = useState<Filters>(value);
  const [open, setOpen] = useState<boolean>(false);

  useEffect(() => setDraft(value), [value]);

  const set = (key: keyof Filters) => (text: string) => setDraft((d) => ({ ...d, [key]: text }));
  const chosen = branches.find((b) => b.name === draft.branch);
  const fridgeNames = [...new Set((chosen ? [chosen] : branches).flatMap((b) => b.fridges.map((f) => f.name)))];

  const onBranch = (name: string) => {
    const fridges = branches.find((b) => b.name === name)?.fridges.map((f) => f.name);
    setDraft((d) => ({ ...d, branch: name, fridge: fridges && !fridges.includes(d.fridge ?? "") ? "" : d.fridge }));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onApply({
      branch: draft.branch ?? "",
      fridge: draft.fridge ?? "",
      dateFrom: draft.dateFrom ?? "",
      dateTo: draft.dateTo ?? "",
      tempMin: draft.tempMin ?? "",
      tempMax: draft.tempMax ?? "",
    });
    setOpen(false);
  };

  return (
    <div className={styles.filters}>
      <div className={styles.chips}>
        {chips(value, unit).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`${styles.chip} ${styles.on}`}
            aria-label={`Remove filter ${label}`}
            onClick={() => onApply({ ...value, [key]: "" })}
          >
            {label} ✕
          </button>
        ))}
        <button type="button" className={styles.chip} aria-expanded={open} onClick={() => setOpen(!open)}>
          + Filter
        </button>
      </div>
      <form className={styles.form} data-open={open} onSubmit={submit} aria-label="Filters">
        <Field label="Branch" error={errors.branch}>
          {(control) => (
            <Select
              {...control}
              options={[{ value: "", label: "All" }, ...branches.map((b) => ({ value: b.name, label: b.name }))]}
              value={draft.branch ?? ""}
              onChange={onBranch}
            />
          )}
        </Field>
        <Field label="Fridge" error={errors.fridge}>
          {(control) => (
            <Select
              {...control}
              options={[{ value: "", label: "All" }, ...fridgeNames.map((name) => ({ value: name, label: name }))]}
              value={draft.fridge ?? ""}
              onChange={set("fridge")}
            />
          )}
        </Field>
        <DateTimeField label="From" dateOnly value={draft.dateFrom ?? ""} onChange={set("dateFrom")} error={errors.date_from} />
        <DateTimeField label="To" dateOnly value={draft.dateTo ?? ""} onChange={set("dateTo")} error={errors.date_to} />
        <TemperatureField
          label={`Min °${unit}`}
          placeholder="e.g. 5"
          value={draft.tempMin ?? ""}
          onChange={set("tempMin")}
          error={errors.temp_min}
        />
        <TemperatureField
          label={`Max °${unit}`}
          placeholder="—"
          value={draft.tempMax ?? ""}
          onChange={set("tempMax")}
          error={errors.temp_max}
        />
        <Button type="submit" className={styles.apply}>
          Apply
        </Button>
      </form>
    </div>
  );
}

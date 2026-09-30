import type { Branch } from "../../lib/endpoints";
import { Combobox } from "../Combobox/Combobox";

interface LoggerFieldProps {
  branch: Branch | undefined;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

/** Pick the logger of one of the branch's fridges or type another id. */
export function LoggerField({ branch, value, onChange, error }: LoggerFieldProps) {
  const ids = (branch?.fridges ?? []).flatMap((fridge) => (fridge.logger_id ? [fridge.logger_id] : []));
  return (
    <Combobox
      label="Logger id"
      value={value}
      options={ids}
      newOptionLabel={(text) => `Use “${text}” as a new logger…`}
      onChange={onChange}
      hint="Filled from the fridge; you can type another id."
      error={error}
      mono
    />
  );
}

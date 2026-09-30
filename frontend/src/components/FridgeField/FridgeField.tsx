import type { Branch } from "../../lib/endpoints";
import { Combobox } from "../Combobox/Combobox";

interface FridgeFieldProps {
  branch: Branch | undefined;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

/** Pick a fridge of the chosen branch or type a new one; a new branch has no fridges yet. */
export function FridgeField({ branch, value, onChange, error }: FridgeFieldProps) {
  return (
    <Combobox
      label="Fridge"
      value={value}
      options={branch?.fridges.map((fridge) => fridge.name) ?? []}
      newOptionLabel={(text) => `Use “${text}” as a new fridge…`}
      onChange={onChange}
      error={error}
    />
  );
}

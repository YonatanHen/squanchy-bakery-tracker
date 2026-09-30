import type { Branch } from "../../lib/endpoints";
import { Combobox } from "../Combobox/Combobox";

interface BranchFieldProps {
  branches: Branch[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

/** Pick a registered branch or type a new one. */
export function BranchField({ branches, value, onChange, error }: BranchFieldProps) {
  return (
    <Combobox
      label="Branch"
      value={value}
      options={branches.map((branch) => branch.name)}
      newOptionLabel={(text) => `Use “${text}” as a new branch…`}
      onChange={onChange}
      error={error}
    />
  );
}

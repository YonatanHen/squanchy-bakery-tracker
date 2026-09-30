import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Field } from "../Field";
import { Select } from "./Select";

const BRANCHES = [
  { value: "", label: "All" },
  { value: "Haifa", label: "Haifa" },
];

describe("Select", () => {
  it("is labeled by its Field and reports the picked value", async () => {
    const onChange = vi.fn();
    render(
      <Field label="Branch">{(control) => <Select {...control} options={BRANCHES} value="" onChange={onChange} />}</Field>,
    );

    await userEvent.selectOptions(screen.getByLabelText("Branch"), "Haifa");

    expect(onChange).toHaveBeenCalledWith("Haifa");
  });

  it("shows the given options in order", () => {
    render(<Select aria-label="Branch" options={BRANCHES} value="Haifa" onChange={() => {}} />);

    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["All", "Haifa"]);
    expect(screen.getByRole("combobox", { name: "Branch" })).toHaveValue("Haifa");
  });
});

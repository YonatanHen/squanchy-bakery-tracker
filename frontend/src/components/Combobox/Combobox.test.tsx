import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Combobox } from "./Combobox";

const BRANCHES = ["Haifa", "Rishon LeZion", "Tel Aviv"];

/** A Combobox with its own value state; reports each change to `onChange`. */
function Harness({ onChange = () => {}, initial = "" }: { onChange?: (value: string) => void; initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <Combobox
      label="Branch"
      value={value}
      options={BRANCHES}
      newOptionLabel={(text) => `Use “${text}” as a new branch…`}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

/** The option texts of the open list. */
function optionTexts(): string[] {
  return within(screen.getByRole("listbox")).getAllByRole("option").map((option) => option.textContent ?? "");
}

describe("Combobox", () => {
  it("filters the options by the typed text and picks one on click", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    const input = screen.getByRole("combobox", { name: "Branch" });
    await userEvent.type(input, "ris");
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(optionTexts()).toEqual(["Rishon LeZion", "Use “ris” as a new branch…"]);

    await userEvent.click(screen.getByRole("option", { name: "Rishon LeZion" }));
    expect(onChange).toHaveBeenLastCalledWith("Rishon LeZion");
    expect(input).toHaveValue("Rishon LeZion");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

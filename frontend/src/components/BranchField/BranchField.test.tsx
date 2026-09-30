import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { makeBranch } from "../../testUtils";
import { BranchField } from "./BranchField";

const BRANCHES = [makeBranch(1, "Haifa"), makeBranch(2, "Rishon LeZion")];

describe("BranchField", () => {
  it("offers the registered branch names, or the typed name as a new branch", async () => {
    render(<BranchField branches={BRANCHES} value="Ris" onChange={() => {}} />);

    await userEvent.type(screen.getByRole("combobox", { name: "Branch" }), "{ArrowDown}");

    const options = within(screen.getByRole("listbox")).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Rishon LeZion", "Use “Ris” as a new branch…"]);
  });
});

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { makeBranch, makeFridge } from "../../testUtils";
import { FridgeField } from "./FridgeField";

const HAIFA = makeBranch(1, "Haifa", [makeFridge(1, "Dairy", "TL-0231"), makeFridge(2, "Cream cakes", "TL-0388")]);

describe("FridgeField", () => {
  it("offers only the fridges of the chosen branch", async () => {
    render(<FridgeField branch={HAIFA} value="" onChange={() => {}} />);

    await userEvent.type(screen.getByRole("combobox", { name: "Fridge" }), "{ArrowDown}");

    const options = within(screen.getByRole("listbox")).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Dairy", "Cream cakes"]);
  });

  it("offers only the typed name as a new fridge when the branch is new", async () => {
    render(<FridgeField branch={undefined} value="Display" onChange={() => {}} />);

    await userEvent.type(screen.getByRole("combobox", { name: "Fridge" }), "{ArrowDown}");

    const options = within(screen.getByRole("listbox")).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Use “Display” as a new fridge…"]);
  });
});

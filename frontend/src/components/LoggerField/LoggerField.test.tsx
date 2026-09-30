import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { makeBranch, makeFridge } from "../../testUtils";
import { LoggerField } from "./LoggerField";

const HAIFA = makeBranch(1, "Haifa", [makeFridge(1, "Dairy", "TL-0231"), makeFridge(2, "Spare", null)]);

describe("LoggerField", () => {
  it("offers the logger ids of the branch's fridges, with a hint that another id can be typed", async () => {
    render(<LoggerField branch={HAIFA} value="" onChange={() => {}} />);

    const input = screen.getByRole("combobox", { name: "Logger id" });
    expect(input).toHaveAccessibleDescription("Filled from the fridge; you can type another id.");
    await userEvent.type(input, "{ArrowDown}");

    const options = within(screen.getByRole("listbox")).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["TL-0231"]);
  });
});

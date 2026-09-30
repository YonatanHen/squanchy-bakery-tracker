import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Branch, Fridge } from "../../lib/endpoints";
import { ReadingFilters } from "./ReadingFilters";

/** A branch with one fridge; only the names matter to the filters. */
function branch(id: number, name: string, fridge: string): Branch {
  const f: Fridge = { id, name: fridge, metric: "C", logger_id: null, threshold_settings_id: 1, avg_temp: null, last_measured: null };
  return { id, name, city: null, street: null, building_number: null, fridges: [f] };
}

const BRANCHES: Branch[] = [branch(1, "Haifa", "Dairy"), branch(2, "Rishon LeZion", "Cream cakes")];

describe("ReadingFilters", () => {
  it("applies the branch, fridge, dates and temperature range together", async () => {
    const onApply = vi.fn();
    render(<ReadingFilters branches={BRANCHES} unit="C" value={{}} onApply={onApply} />);

    await userEvent.selectOptions(screen.getByLabelText("Branch"), "Rishon LeZion");
    await userEvent.selectOptions(screen.getByLabelText("Fridge"), "Cream cakes");
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-09-14" } });
    await userEvent.type(screen.getByLabelText("Min °C"), "5");
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(onApply).toHaveBeenCalledWith({
      branch: "Rishon LeZion",
      fridge: "Cream cakes",
      dateFrom: "2026-09-14",
      dateTo: "",
      tempMin: "5",
      tempMax: "",
    });
  });

  it("offers only the chosen branch's fridges", async () => {
    render(<ReadingFilters branches={BRANCHES} unit="C" value={{}} onApply={() => {}} />);

    await userEvent.selectOptions(screen.getByLabelText("Branch"), "Haifa");

    const fridges = screen.getByLabelText("Fridge");
    expect([...fridges.querySelectorAll("option")].map((o) => o.textContent)).toEqual(["All", "Dairy"]);
  });

  it("labels the temperature range in the selected unit", () => {
    render(<ReadingFilters branches={BRANCHES} unit="F" value={{}} onApply={() => {}} />);

    expect(screen.getByLabelText("Min °F")).toBeInTheDocument();
    expect(screen.getByLabelText("Max °F")).toBeInTheDocument();
  });

  it("shows the applied filters as chips that remove one filter each", async () => {
    const onApply = vi.fn();
    render(
      <ReadingFilters branches={BRANCHES} unit="C" value={{ fridge: "Cream cakes", tempMin: "5" }} onApply={onApply} />,
    );

    expect(screen.getByRole("button", { name: "Remove filter Above 5 °C" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove filter Fridge: Cream cakes" }));

    expect(onApply).toHaveBeenCalledWith({ fridge: "", tempMin: "5" });
  });

  it("links the backend's error to the matching field", () => {
    render(
      <ReadingFilters
        branches={BRANCHES}
        unit="C"
        value={{}}
        errors={{ temp_min: "Input should be a valid number" }}
        onApply={() => {}}
      />,
    );

    expect(screen.getByLabelText("Min °C")).toHaveAccessibleDescription("Input should be a valid number");
  });
});

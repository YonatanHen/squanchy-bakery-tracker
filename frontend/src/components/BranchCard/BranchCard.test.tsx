import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Branch, Fridge } from "../../lib/endpoints";
import { BranchCard } from "./BranchCard";

const DAIRY: Fridge = {
  id: 3,
  name: "Dairy",
  metric: "F",
  logger_id: "TL-0231",
  threshold_settings_id: 1,
  avg_temp: 38.3,
  last_measured: "2026-09-14T06:00:00",
};
const HAIFA: Branch = { id: 2, name: "Haifa", city: null, street: null, building_number: null, fridges: [DAIRY] };
const PROFILES = { 1: "default" };

/** Render a BranchCard with spy callbacks. */
function renderCard(branch: Branch = HAIFA) {
  const handlers = { onEdit: vi.fn(), onDelete: vi.fn(), onEditFridge: vi.fn(), onDeleteFridge: vi.fn() };
  render(<BranchCard branch={branch} profileNames={PROFILES} {...handlers} />);
  return handlers;
}

describe("BranchCard", () => {
  it("lists each fridge with its logger, unit and threshold profile (Haifa logs in °F)", () => {
    renderCard();

    const row = screen.getByRole("listitem");
    expect(within(row).getByText("Dairy")).toBeInTheDocument();
    expect(within(row).getByText("TL-0231")).toBeInTheDocument();
    expect(within(row).getByText("°F")).toBeInTheDocument();
    expect(within(row).getByText("default")).toBeInTheDocument();
  });

  it("offers + Add address when the branch has no address, and it opens the edit", async () => {
    const { onEdit } = renderCard();

    await userEvent.click(screen.getByRole("button", { name: "+ Add address" }));

    expect(onEdit).toHaveBeenCalledWith(HAIFA);
  });

  it("shows the street, building number and city when they are set", () => {
    renderCard({ ...HAIFA, name: "Rishon LeZion", city: "Rishon LeZion", street: "Herzl", building_number: "12a" });

    expect(screen.getByText("Herzl 12a, Rishon LeZion")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Add address" })).not.toBeInTheDocument();
  });

  it("shows a dash for a fridge without a logger", () => {
    renderCard({ ...HAIFA, fridges: [{ ...DAIRY, logger_id: null }] });

    expect(within(screen.getByRole("listitem")).getByText("—")).toBeInTheDocument();
  });

  it("sends the branch or the fridge to the edit and delete actions", async () => {
    const handlers = renderCard();

    await userEvent.click(screen.getByRole("button", { name: "Edit Haifa" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete Haifa" }));
    await userEvent.click(screen.getByRole("button", { name: "Edit fridge Dairy" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete fridge Dairy" }));

    expect(handlers.onEdit).toHaveBeenCalledWith(HAIFA);
    expect(handlers.onDelete).toHaveBeenCalledWith(HAIFA);
    expect(handlers.onEditFridge).toHaveBeenCalledWith(DAIRY);
    expect(handlers.onDeleteFridge).toHaveBeenCalledWith(DAIRY);
  });
});

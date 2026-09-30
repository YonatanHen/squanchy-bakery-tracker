import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ThresholdSettingsValues } from "../../lib/endpoints";
import { ThresholdSettingsForm } from "./ThresholdSettingsForm";

const DEFAULT: ThresholdSettingsValues = {
  name: "default",
  growth_non_urgent: "0.1",
  growth_urgent: "1",
  deviation_non_urgent: "1.5",
  deviation_urgent: "3",
  gap_non_urgent_minutes: "15",
  gap_urgent_minutes: "120",
};

describe("ThresholdSettingsForm", () => {
  it("shows the name, the fridge count and the six limits", () => {
    render(<ThresholdSettingsForm initial={DEFAULT} fridges={4} onSave={() => {}} />);

    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("default");
    expect(screen.getByText("Used by 4 fridges")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Rise non-urgent, degrees C" })).toHaveValue("0.1");
    expect(screen.getByRole("textbox", { name: "Rise urgent, degrees C" })).toHaveValue("1");
    expect(screen.getByRole("textbox", { name: "Deviation non-urgent, degrees C" })).toHaveValue("1.5");
    expect(screen.getByRole("textbox", { name: "Deviation urgent, degrees C" })).toHaveValue("3");
    expect(screen.getByRole("textbox", { name: "Gap non-urgent, minutes" })).toHaveValue("15");
    expect(screen.getByRole("textbox", { name: "Gap urgent, minutes" })).toHaveValue("120");
  });

  it("warns that saving changes alerts for every fridge using these settings", () => {
    render(<ThresholdSettingsForm initial={DEFAULT} fridges={4} onSave={() => {}} />);

    expect(screen.getByText(/Saving changes future alerts for all 4 fridges that use these settings/)).toBeInTheDocument();
  });

  it("uses the singular for one fridge", () => {
    render(<ThresholdSettingsForm initial={DEFAULT} fridges={1} onSave={() => {}} />);

    expect(screen.getByText("Used by 1 fridge")).toBeInTheDocument();
    expect(screen.getByText(/Saving changes future alerts for the 1 fridge that uses these settings/)).toBeInTheDocument();
  });

  it("does not warn for settings no fridge uses", () => {
    render(<ThresholdSettingsForm initial={DEFAULT} fridges={0} onSave={() => {}} />);

    expect(screen.queryByText(/Are you sure/)).not.toBeInTheDocument();
  });

  it("saves the values as typed", async () => {
    const onSave = vi.fn();
    render(<ThresholdSettingsForm initial={DEFAULT} fridges={4} onSave={onSave} />);

    const gap = screen.getByRole("textbox", { name: "Gap non-urgent, minutes" });
    await userEvent.clear(gap);
    await userEvent.type(gap, "30");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith({ ...DEFAULT, gap_non_urgent_minutes: "30" });
  });

  it("shows each error under its field", () => {
    render(
      <ThresholdSettingsForm
        initial={DEFAULT}
        fridges={4}
        onSave={() => {}}
        errors={{ name: "String should have at least 1 character", growth_non_urgent: "Must be lower than the urgent limit" }}
      />,
    );

    expect(screen.getByRole("textbox", { name: "Name" })).toHaveAccessibleDescription(
      "Used by 4 fridges String should have at least 1 character",
    );
    expect(screen.getByRole("textbox", { name: "Rise non-urgent, degrees C" })).toHaveAccessibleDescription(
      "Must be lower than the urgent limit",
    );
  });
});

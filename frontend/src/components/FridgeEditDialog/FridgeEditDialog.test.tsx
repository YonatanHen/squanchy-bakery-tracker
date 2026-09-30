import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/api";
import type { Fridge, ThresholdSettings } from "../../lib/endpoints";
import { FridgeEditDialog } from "./FridgeEditDialog";

const WALK_IN: Fridge = {
  id: 2,
  name: "Walk-in",
  metric: "C",
  logger_id: "TL-0417",
  threshold_settings_id: 1,
  avg_temp: 3.1,
  last_measured: null,
};
const LIMITS = {
  growth_non_urgent: 0.1,
  growth_urgent: 1,
  deviation_non_urgent: 1.5,
  deviation_urgent: 3,
  gap_non_urgent_minutes: 15,
  gap_urgent_minutes: 120,
};
const SETTINGS: ThresholdSettings[] = [
  { id: 1, name: "default", fridges: 4, ...LIMITS },
  { id: 2, name: "Cream cakes", fridges: 0, ...LIMITS },
];

/** Render the dialog for Tel Aviv's walk-in fridge with a spy onSave. */
function renderDialog(onSave = vi.fn(async () => {}), fridge: Fridge = WALK_IN) {
  const onCancel = vi.fn();
  render(
    <FridgeEditDialog fridge={fridge} branchName="Tel Aviv" thresholdSettings={SETTINGS} onSave={onSave} onCancel={onCancel} />,
  );
  return { onSave, onCancel };
}

describe("FridgeEditDialog", () => {
  it("starts from the fridge's current name, unit, logger and threshold settings", () => {
    renderDialog();

    expect(screen.getByRole("dialog", { name: "Edit fridge" })).toHaveAccessibleDescription("Tel Aviv · Walk-in");
    expect(screen.getByLabelText("Name")).toHaveValue("Walk-in");
    expect(screen.getByRole("button", { name: "°C" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Logger")).toHaveValue("TL-0417");
    expect(screen.getByLabelText("Threshold settings")).toHaveValue("1");
  });

  it("saves a rename with only the name", async () => {
    const { onSave } = renderDialog();

    await userEvent.clear(screen.getByLabelText("Name"));
    await userEvent.type(screen.getByLabelText("Name"), "Display 2");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith({ name: "Display 2" });
  });

  it("saves a Fahrenheit logger, a moved logger and other threshold settings", async () => {
    const { onSave } = renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "°F" }));
    await userEvent.clear(screen.getByLabelText("Logger"));
    await userEvent.type(screen.getByLabelText("Logger"), "TL-0231");
    await userEvent.selectOptions(screen.getByLabelText("Threshold settings"), "Cream cakes");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith({ metric: "F", logger_id: "TL-0231", threshold_settings_id: 2 });
  });

  it("closes without saving when nothing changed", async () => {
    const { onSave, onCancel } = renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("shows a 422 logger error under the Logger field", async () => {
    const message = "String should match pattern '^TL-\\d{4}$'";
    const error = new ApiError(422, "Unprocessable", [{ field: "logger_id", message }]);
    renderDialog(vi.fn(async () => Promise.reject(error)));

    await userEvent.clear(screen.getByLabelText("Logger"));
    await userEvent.type(screen.getByLabelText("Logger"), "0231");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByLabelText("Logger")).toHaveAccessibleDescription(expect.stringContaining(message));
  });

  it("shows the backend message when the logger id is used by another fridge", async () => {
    const error = new ApiError(409, "Conflicts with existing data (duplicate name, logger id or reading time)");
    renderDialog(vi.fn(async () => Promise.reject(error)));

    await userEvent.clear(screen.getByLabelText("Logger"));
    await userEvent.type(screen.getByLabelText("Logger"), "TL-0512");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Conflicts with existing data");
  });
});

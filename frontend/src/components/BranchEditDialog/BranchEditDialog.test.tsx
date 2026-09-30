import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/api";
import type { Branch } from "../../lib/endpoints";
import { BranchEditDialog } from "./BranchEditDialog";

const RISHON: Branch = {
  id: 4,
  name: "Rishon LeZion",
  city: "Rishon LeZion",
  street: null,
  building_number: null,
  fridges: [],
};

/** Render the dialog with a spy onSave that resolves unless given another implementation. */
function renderDialog(onSave = vi.fn(async () => {})) {
  const onCancel = vi.fn();
  render(<BranchEditDialog branch={RISHON} onSave={onSave} onCancel={onCancel} />);
  return { onSave, onCancel };
}

describe("BranchEditDialog", () => {
  it("starts from the branch's current values", () => {
    renderDialog();

    expect(screen.getByRole("dialog", { name: "Edit branch" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Rishon LeZion");
    expect(screen.getByLabelText("City")).toHaveValue("Rishon LeZion");
    expect(screen.getByLabelText("Street")).toHaveValue("");
    expect(screen.getByLabelText("Building number")).toHaveValue("");
  });

  it("saves only the changed fields", async () => {
    const { onSave } = renderDialog();

    await userEvent.type(screen.getByLabelText("Street"), "Herzl");
    await userEvent.type(screen.getByLabelText("Building number"), "12a");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith({ street: "Herzl", building_number: "12a" });
  });

  it("sends null for a cleared address field", async () => {
    const { onSave } = renderDialog();

    await userEvent.clear(screen.getByLabelText("City"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith({ city: null });
  });

  it("closes without saving when nothing changed", async () => {
    const { onSave, onCancel } = renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("shows 422 field errors under their fields", async () => {
    const error = new ApiError(422, "Unprocessable", [{ field: "name", message: "String should have at least 1 character" }]);
    renderDialog(vi.fn(async () => Promise.reject(error)));

    await userEvent.clear(screen.getByLabelText("Name"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("String should have at least 1 character")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveAccessibleDescription("String should have at least 1 character");
    expect(screen.getByRole("dialog", { name: "Edit branch" })).toBeInTheDocument();
  });

  it("shows the backend message for a duplicate branch name", async () => {
    const error = new ApiError(409, "Conflicts with existing data (duplicate name, logger id or reading time)");
    renderDialog(vi.fn(async () => Promise.reject(error)));

    await userEvent.clear(screen.getByLabelText("Name"));
    await userEvent.type(screen.getByLabelText("Name"), "Haifa");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Conflicts with existing data");
  });
});

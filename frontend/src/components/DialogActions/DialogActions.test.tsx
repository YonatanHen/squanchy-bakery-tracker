import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DialogActions } from "./DialogActions";

describe("DialogActions", () => {
  it("cancels from Cancel and confirms from the confirm button", async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<DialogActions confirmLabel="Delete branch" variant="danger" onCancel={onCancel} onConfirm={onConfirm} />);

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete branch" }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Delete branch" })).toHaveAttribute("data-variant", "danger");
  });

  it("submits its form when there is no onConfirm, and is disabled while busy", () => {
    render(<DialogActions confirmLabel="Save" busy onCancel={() => {}} />);

    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toHaveAttribute("type", "submit");
    expect(save).toBeDisabled();
  });
});

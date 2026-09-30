import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DeleteImpactDialog } from "./DeleteImpactDialog";

const IMPACT = { fridges: 1, loggers: 1, readings: 5, alerts: 2 };

/** Render the dialog for the Tel Aviv branch with spy callbacks. */
function renderDialog(props: Partial<Parameters<typeof DeleteImpactDialog>[0]> = {}) {
  const onCancel = vi.fn();
  const onConfirm = vi.fn();
  render(
    <DeleteImpactDialog kind="branch" name="Tel Aviv" impact={IMPACT} onCancel={onCancel} onConfirm={onConfirm} {...props} />,
  );
  return { onCancel, onConfirm };
}

describe("DeleteImpactDialog", () => {
  it("shows what the branch delete removes and what it archives", () => {
    renderDialog();

    expect(screen.getByRole("dialog", { name: "Delete Tel Aviv?" })).toBeInTheDocument();
    expect(screen.getByText("This removes the branch with its fridges and loggers.")).toBeInTheDocument();
    expect(screen.getByText("fridge removed").previousSibling).toHaveTextContent("1");
    expect(screen.getByText("logger removed").previousSibling).toHaveTextContent("1");
    expect(screen.getByText("readings archived").previousSibling).toHaveTextContent("5");
    expect(screen.getByText("alerts archived").previousSibling).toHaveTextContent("2");
    expect(
      screen.getByText("Archived readings and alerts stay available for questions later (Alerts → Archived)."),
    ).toBeInTheDocument();
  });

  it("uses the plural for zero or many and the singular for one", () => {
    renderDialog({ impact: { fridges: 3, loggers: 0, readings: 1, alerts: 1 } });

    expect(screen.getByText("fridges removed")).toBeInTheDocument();
    expect(screen.getByText("loggers removed")).toBeInTheDocument();
    expect(screen.getByText("reading archived")).toBeInTheDocument();
    expect(screen.getByText("alert archived")).toBeInTheDocument();
  });

  it("words a fridge delete for the fridge and its logger", () => {
    renderDialog({ kind: "fridge", name: "Dairy" });

    expect(screen.getByRole("dialog", { name: "Delete Dairy?" })).toBeInTheDocument();
    expect(screen.getByText("This removes the fridge with its logger.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete fridge" })).toBeInTheDocument();
  });

  it("confirms only from the Delete button and cancels from Cancel", async () => {
    const { onCancel, onConfirm } = renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Delete branch" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("disables Delete while the delete runs and shows a failure", () => {
    renderDialog({ busy: true, error: "Could not delete. Try again." });

    expect(screen.getByRole("button", { name: "Delete branch" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not delete. Try again.");
  });
});
